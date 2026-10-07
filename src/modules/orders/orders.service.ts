import { OrderPageDto } from '../../common/dto/list-page.dto.js';
import { pageWindow } from '../../common/utils/page-window.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { isUUID } from 'class-validator';
import { Prisma } from '../../generated/prisma/client.js';
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

  async readSummary(user: Profile) {
    const rows = await this.prisma.order.groupBy({ by: ['status'], where: this.scope(user), _count: { _all: true } });
    return Object.fromEntries(['NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map(status => [status, rows.find(row => row.status === status)?._count._all ?? 0]));
  }

  readPage(user: Profile, query: OrderPageDto) {
    return this.prisma.$transaction(async (tx) => {
      const where = { ...this.scope(user), ...(query.protocol ? { protocol: query.protocol } : {}), ...(query.status ? { status: query.status } : {}) };
      const total = await tx.order.count({ where });
      const meta = pageWindow(total, query);
      const items = await tx.order.findMany({ where, include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (meta.page - 1) * meta.limit, take: meta.limit });
      const counts = await tx.order.groupBy({ by: ['status'], where: this.scope(user), _count: { _all: true } });
      const summary = Object.fromEntries(['NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map(status => [status, counts.find(row => row.status === status)?._count._all ?? 0]));
      return { ...meta, items, summary };
    }, { isolationLevel: 'RepeatableRead' });
  }
  async readOne(id: string, user: Profile) {
    const order = await this.prisma.order.findFirst({
      where: { id, ...this.scope(user) },
      include,
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  async create(user: Profile, dto: CreateOrderDto, key?: string) {
    if (key !== undefined && !isUUID(key, '4'))
      throw new BadRequestException('Idempotency-Key deve ser um UUID v4.');
    const idempotencyKey = key?.toLowerCase();
    const requestHash = createHash('sha256').update(JSON.stringify({
      variantId: dto.variantId.toLowerCase(), type: dto.type,
      startDate: dto.startDate ?? null, endDate: dto.endDate ?? null,
      notes: dto.notes ?? '',
    })).digest('hex');
    const replay = async (db: Prisma.TransactionClient) => {
      if (!idempotencyKey) return null;
      const existing = await db.order.findUnique({
        where: { profileId_idempotencyKey: { profileId: user.id, idempotencyKey } }, include,
      });
      if (existing && existing.requestHash !== requestHash)
        throw new ConflictException('Esta tentativa de envio já foi usada com outros dados. Consulte seus pedidos antes de iniciar um novo.');
      return existing;
    };
    try {
      return await this.prisma.atomic(async (tx) => {
        // Replay precedes availability/date checks: a successful request must
        // still be recoverable after prices, dates or catalogue activity change.
        const existing = await replay(tx);
        if (existing) return existing;
        const variant = await tx.variant.findUnique({
          where: { id: dto.variantId }, include: { product: true },
        });
        if (!variant?.product.active)
          throw new NotFoundException('Produto indisponível.');
        const dates = operationDates(dto.type, dto.startDate, dto.endDate);
        return tx.order.create({
          data: {
            profileId: user.id, variantId: variant.id, type: dto.type, ...dates,
            ...(idempotencyKey ? { idempotencyKey, requestHash } : {}),
            protocol: 'AR-' + randomBytes(8).toString('hex').toUpperCase(),
            quotedPriceCents: dto.type === 'SALE' ? variant.product.salePriceCents : variant.product.rentalPriceCents,
            customerName: user.name, customerEmail: user.email,
            customerPhone: user.phone, customerDocument: user.document,
            notes: dto.notes ?? '',
            history: { create: { status: 'NEW', note: 'Pedido recebido.' } },
          }, include,
        });
      });
    } catch (error) {
      // Concurrent requests can pass the first lookup. The unique index is
      // the final arbiter; only read after the losing transaction rolled back.
      if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await replay(this.prisma);
        if (existing) return existing;
      }
      throw error;
    }
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
