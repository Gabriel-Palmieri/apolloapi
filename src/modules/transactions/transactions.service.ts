import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from '../stock/stock.service.js';
import type {
  Prisma,
  Profile,
  Transaction,
} from '../../generated/prisma/client.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { operationDates, today } from '../../common/utils/dates.js';
import { PageDto } from '../../common/dto/page.dto.js';
import { pagination } from '../../common/utils/pagination.js';
const include = { payment: true, variant: { include: { product: true } } };
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  private scope(user: Profile) {
    return user.role === 'ADMIN' ? {} : { profileId: user.id };
  }

  read(user: Profile, query: PageDto) {
    return this.prisma.transaction.findMany({
      where: this.scope(user),
      include,
      orderBy: { createdAt: 'desc' },
      ...pagination(query),
    });
  }

  async readOne(id: string, user: Profile) {
    const row = await this.prisma.transaction.findFirst({
      where: { id, ...this.scope(user) },
      include,
    });
    if (!row) throw new NotFoundException('Transação não encontrada.');
    return row;
  }

  async readConflicts() {
    const rows = await this.prisma.transaction.findMany({
      where: { type: 'RENTAL', status: 'CONFIRMED' },
      include,
    });
    const conflicts: {
      transactionId: string;
      overdueTransactionIds: string[];
    }[] = [];
    for (const row of rows) {
      if (!row.startDate || !row.endDate || row.endDate < today()) continue;
      const result = await this.stock.availability(
        this.prisma,
        row.variantId,
        row.startDate,
        row.endDate,
      );
      if (result.hasConflict)
        conflicts.push({
          transactionId: row.id,
          overdueTransactionIds: result.overdueTransactionIds,
        });
    }
    return {
      conflicts,
      overdue: rows
        .filter((r) => r.pickedUpAt && r.endDate && r.endDate < today())
        .map((r) => r.id),
    };
  }

  create(dto: CreateTransactionDto) {
    return this.prisma.atomic(async (tx) => {
      if (!(await tx.profile.findUnique({ where: { id: dto.profileId } })))
        throw new NotFoundException('Cliente não encontrado.');
      const variant = await tx.variant.findUnique({
        where: { id: dto.variantId },
        include: { product: true },
      });
      if (!variant?.product.active)
        throw new NotFoundException('Produto indisponível.');
      return tx.transaction.create({
        data: {
          profileId: dto.profileId,
          variantId: dto.variantId,
          type: dto.type,
          ...operationDates(dto.type, dto.startDate, dto.endDate),
          priceCents:
            dto.priceCents ??
            (dto.type === 'SALE'
              ? variant.product.salePriceCents
              : variant.product.rentalPriceCents),
        },
        include,
      });
    });
  }

  update(id: string, dto: UpdateTransactionDto) {
    return this.prisma.atomic(async (tx) => {
      const row = await this.findTransactionOrThrow(tx, id);
      if (row.status !== 'DRAFT')
        throw new ConflictException('Somente rascunhos podem ser editados.');
      if (dto.variantId) {
        const variant = await tx.variant.findUnique({
          where: { id: dto.variantId },
          include: { product: true },
        });
        if (!variant?.product.active)
          throw new NotFoundException('Produto indisponível.');
      }
      const dates = operationDates(
        row.type,
        dto.startDate ?? row.startDate?.toISOString().slice(0, 10),
        dto.endDate ?? row.endDate?.toISOString().slice(0, 10),
      );
      return tx.transaction.update({
        where: { id },
        data: { ...dto, ...dates },
        include,
      });
    });
  }

  private async findTransactionOrThrow(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const row = await tx.transaction.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException('Transação não encontrada.');
    return row;
  }

  private async assertCapacity(tx: Prisma.TransactionClient, row: Transaction) {
    const dates = operationDates(
      row.type,
      row.startDate?.toISOString().slice(0, 10),
      row.endDate?.toISOString().slice(0, 10),
    );
    const use = await this.stock.availability(
      tx,
      row.variantId,
      dates.startDate ?? today(),
      dates.endDate,
      row.id,
    );
    if (!use.active || use.available < 1)
      throw new ConflictException(
        'Sem disponibilidade para confirmar esta operação.',
      );
  }

  confirm(id: string) {
    return this.prisma.atomic(async (tx) => {
      const row = await this.findTransactionOrThrow(tx, id);
      if (row.status === 'CONFIRMED' || row.status === 'COMPLETED') return row;
      if (row.status !== 'DRAFT')
        throw new ConflictException('Operação cancelada.');
      await this.assertCapacity(tx, row);
      if (row.type === 'SALE')
        await tx.variant.update({
          where: { id: row.variantId },
          data: { quantity: { decrement: 1 } },
        });
      return tx.transaction.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          payment: { create: { amountCents: row.priceCents, simulated: true } },
        },
        include,
      });
    });
  }

  cancel(id: string) {
    return this.prisma.atomic(async (tx) => {
      const row = await this.findTransactionOrThrow(tx, id);
      if (row.status === 'CANCELLED') return row;
      if (row.status === 'COMPLETED' || row.pickedUpAt)
        throw new ConflictException('Operação já entregue ou retirada.');
      if (row.type === 'SALE' && row.status === 'CONFIRMED')
        await tx.variant.update({
          where: { id: row.variantId },
          data: { quantity: { increment: 1 } },
        });
      if (row.payment)
        await tx.payment.update({
          where: { transactionId: id },
          data: {
            status: row.payment.status === 'PAID' ? 'REFUNDED' : 'CANCELLED',
          },
        });
      return tx.transaction.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        include,
      });
    });
  }

  pickup(id: string) {
    return this.prisma.atomic(async (tx) => {
      const row = await this.findTransactionOrThrow(tx, id);
      if (row.type !== 'RENTAL')
        throw new ConflictException('Retirada disponível apenas para locação.');
      if (row.pickedUpAt) return row;
      if (row.status !== 'CONFIRMED' || !row.startDate || !row.endDate)
        throw new ConflictException('Confirme a locação antes da retirada.');
      const now = today();
      if (now < row.startDate || now > row.endDate)
        throw new ConflictException('Retirada fora do período contratado.');
      const use = await this.stock.availability(
        tx,
        row.variantId,
        now,
        row.endDate,
        id,
      );
      if (use.available < 1)
        throw new ConflictException(
          'Uma devolução pendente impede esta retirada.',
        );
      return tx.transaction.update({
        where: { id },
        data: { pickedUpAt: new Date() },
        include,
      });
    });
  }

  complete(id: string, action: 'deliver' | 'return', damageNotes?: string) {
    return this.prisma.atomic(async (tx) => {
      const row = await this.findTransactionOrThrow(tx, id);
      if ((action === 'deliver') !== (row.type === 'SALE'))
        throw new ConflictException(
          'Ação incompatível com o tipo de operação.',
        );
      if (row.status === 'COMPLETED') return row;
      if (
        row.status !== 'CONFIRMED' ||
        (row.type === 'RENTAL' && !row.pickedUpAt)
      )
        throw new ConflictException(
          'Operação ainda não está pronta para conclusão.',
        );
      return tx.transaction.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          ...(action === 'return' ? { damageNotes: damageNotes ?? '' } : {}),
        },
        include,
      });
    });
  }

  checkout(id: string, user: Profile) {
    return this.prisma.atomic(async (tx) => {
      const row = await tx.transaction.findFirst({
        where: { id, profileId: user.id },
        include,
      });
      if (!row) throw new NotFoundException('Transação não encontrada.');
      if (row.status !== 'CONFIRMED' && row.status !== 'COMPLETED')
        throw new ConflictException('Confirme a operação antes do checkout.');
      if (row.payment?.status === 'PAID') return row.payment;
      if (!row.payment || row.payment.status !== 'PENDING')
        throw new ConflictException('Pagamento indisponível.');
      return tx.payment.update({
        where: { transactionId: id },
        data: { status: 'PAID', paidAt: new Date() },
      });
    });
  }
}
