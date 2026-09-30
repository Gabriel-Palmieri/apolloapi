import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Profile } from '../../generated/prisma/client.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { operationDates } from '../../common/utils/dates.js';
import { PageDto } from '../../common/dto/page.dto.js';
import { pagination } from '../../common/utils/pagination.js';
const include = {
  history: { orderBy: { createdAt: 'asc' as const } },
  transaction: true,
  variant: { include: { product: true } },
};
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: Profile) {
    return user.role === 'ADMIN' ? {} : { profileId: user.id };
  }

  read(user: Profile, query: PageDto) {
    return this.prisma.order.findMany({
      where: this.scope(user),
      include,
      orderBy: { createdAt: 'desc' },
      ...pagination(query),
    });
  }

  async readOne(id: string, user: Profile) {
    const order = await this.prisma.order.findFirst({
      where: { id, ...this.scope(user) },
      include,
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  create(user: Profile, dto: CreateOrderDto) {
    return this.prisma.atomic(async (tx) => {
      const variant = await tx.variant.findUnique({
        where: { id: dto.variantId },
        include: { product: true },
      });
      if (!variant?.product.active)
        throw new NotFoundException('Produto indisponível.');
      const dates = operationDates(dto.type, dto.startDate, dto.endDate);
      return tx.order.create({
        data: {
          profileId: user.id,
          variantId: variant.id,
          type: dto.type,
          ...dates,
          protocol: 'AR-' + randomBytes(8).toString('hex').toUpperCase(),
          quotedPriceCents:
            dto.type === 'SALE'
              ? variant.product.salePriceCents
              : variant.product.rentalPriceCents,
          customerName: user.name,
          customerEmail: user.email,
          customerPhone: user.phone,
          customerDocument: user.document,
          notes: dto.notes ?? '',
          history: { create: { status: 'NEW', note: 'Pedido recebido.' } },
        },
        include,
      });
    });
  }

  transition(
    id: string,
    action: 'review' | 'approve' | 'reject',
    reason?: string,
  ) {
    return this.prisma.atomic(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include });
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (action === 'approve' && order.status === 'APPROVED') return order;
      if (action === 'review' && order.status === 'UNDER_REVIEW') return order;
      if (order.status === 'APPROVED' || order.status === 'REJECTED')
        throw new ConflictException('Pedido já finalizado.');
      const status =
        action === 'approve'
          ? 'APPROVED'
          : action === 'reject'
            ? 'REJECTED'
            : 'UNDER_REVIEW';
      if (action === 'approve') {
        await tx.transaction.create({
          data: {
            orderId: id,
            profileId: order.profileId,
            variantId: order.variantId,
            type: order.type,
            priceCents: order.quotedPriceCents,
            startDate: order.startDate,
            endDate: order.endDate,
          },
        });
      }
      return tx.order.update({
        where: { id },
        data: {
          status,
          rejectionReason: action === 'reject' ? reason : null,
          history: {
            create: {
              status,
              note:
                reason ??
                (action === 'approve'
                  ? 'Aprovado. Transação criada em rascunho.'
                  : 'Em análise.'),
            },
          },
        },
        include,
      });
    });
  }
}
