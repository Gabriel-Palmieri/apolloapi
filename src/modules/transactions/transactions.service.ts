import { CalendarDto, TransactionPageDto } from '../../common/dto/list-page.dto.js';
import { pageWindow } from '../../common/utils/page-window.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from '../stock/stock.service.js';
import { occupancy } from '../stock/availability.js';
import type {
  Prisma,
  Profile,
  Transaction,
} from '../../generated/prisma/client.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { operationDates, parseDay, today } from '../../common/utils/dates.js';
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

  readPage(user: Profile, query: TransactionPageDto) {
    return this.prisma.$transaction(async (tx) => {
      const where = { ...this.scope(user), ...(query.day ? { startDate: { lte: parseDay(query.day) }, endDate: { gte: parseDay(query.day) } } : {}), ...(query.type ? { type: query.type } : {}), ...(query.status ? { status: query.status } : {}), ...(query.q?.trim() ? {
        AND: query.q.trim().split(/\s+/).map(term => ({ OR: [
          { variant: { product: { name: { contains: term, mode: 'insensitive' as const } } } },
          { profile: { name: { contains: term, mode: 'insensitive' as const } } },
        ] })),
      } : {}) };
      const total = await tx.transaction.count({ where });
      const meta = pageWindow(total, query);
      const items = await tx.transaction.findMany({ where, include: { ...include, profile: { select: { name: true } } },
        orderBy: query.sort === 'date' ? [{ startDate: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }], skip: (meta.page - 1) * meta.limit, take: meta.limit });
      const overdue = await tx.transaction.count({ where: { ...this.scope(user), type: 'RENTAL', status: 'CONFIRMED', pickedUpAt: { not: null }, endDate: { lt: today() } } });
      return { ...meta, items, summary: { overdue } };
    }, { isolationLevel: 'RepeatableRead' });
  }
  async readCalendar(query: CalendarDto) {
    const start = parseDay(query.start), end = parseDay(query.end);
    if (end < start || end.getTime() - start.getTime() > 41 * 86400000)
      throw new BadRequestException('Consulte até 42 dias por vez.');
    // Aggregate in PostgreSQL: the response always has at most 42 rows,
    // regardless of how many reservations overlap the visible calendar.
    return this.prisma.$queryRaw<{ day: string; nSaidas: number; nRetornos: number; nAtivos: number }[]>`
      SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
        count(t.id) FILTER (WHERE t."startDate" = days.day)::int AS "nSaidas",
        count(t.id) FILTER (WHERE t."endDate" = days.day)::int AS "nRetornos",
        count(t.id)::int AS "nAtivos"
      FROM generate_series(${start}::timestamp, ${end}::timestamp, interval '1 day') AS days(day)
      LEFT JOIN "Transaction" t ON t.type = 'RENTAL' AND t.status = 'CONFIRMED'
        AND t."startDate" <= days.day AND t."endDate" >= days.day
      GROUP BY days.day ORDER BY days.day
    `;
  }

  async readDashboard() {
    const now = today();
    const result = await this.prisma.$transaction(async tx => {
      const counts = await tx.product.groupBy({ by: ['active'], _count: { _all: true } });
      const pieces = await tx.variant.aggregate({ _sum: { quantity: true } });
      const value = await tx.transaction.aggregate({ where: { status: { in: ['CONFIRMED', 'COMPLETED'] } }, _sum: { priceCents: true } });
      const rental = { type: 'RENTAL' as const, status: 'CONFIRMED' as const };
      const open = await tx.transaction.count({ where: rental });
      const orders = await tx.order.count({ where: { status: { in: ['NEW', 'UNDER_REVIEW'] } } });
      const outgoing = await tx.transaction.findMany({ where: { ...rental, startDate: { gte: now } }, select: { id: true, startDate: true, profile: { select: { name: true } } }, orderBy: [{ startDate: 'asc' }, { id: 'asc' }], take: 5 });
      const incoming = await tx.transaction.findMany({ where: { ...rental, endDate: { gte: now } }, select: { id: true, endDate: true, profile: { select: { name: true } } }, orderBy: [{ endDate: 'asc' }, { id: 'asc' }], take: 5 });
      const active = counts.find(row => row.active)?._count._all ?? 0;
      const inactive = counts.find(row => !row.active)?._count._all ?? 0;
      const proximos = [
        ...outgoing.map(row => ({ transId: row.id, titulo: row.profile.name, data: row.startDate!.toISOString().slice(0, 10), movimento: 'Retirada', tipo: 'avulsa', nPecas: 1 })),
        ...incoming.map(row => ({ transId: row.id, titulo: row.profile.name, data: row.endDate!.toISOString().slice(0, 10), movimento: 'Devolução', tipo: 'avulsa', nPecas: 1 })),
      ].sort((a, b) => a.data.localeCompare(b.data) || a.movimento.localeCompare(b.movimento) || a.transId.localeCompare(b.transId)).slice(0, 5);
      return { acervo: { modelos: active + inactive, ativos: active, inativos: inactive, pecas: pieces._sum.quantity ?? 0 }, operacoes: { locacoesAbertas: open, valorCentavos: value._sum.priceCents ?? 0 }, pedidos: orders, proximos };
    }, { isolationLevel: 'RepeatableRead' });
    const conflicts = await this.readConflicts();
    return { ...result, pendencias: { pedidos: result.pedidos, devolucoes: conflicts.overdue.length, conflitos: conflicts.conflicts.length } };
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
    const now = today();
    const rows = await this.prisma.transaction.findMany({
      where: { type: 'RENTAL', status: 'CONFIRMED' },
      select: {
        id: true,
        variantId: true,
        startDate: true,
        endDate: true,
        pickedUpAt: true,
        variant: { select: { quantity: true } },
      },
    });
    const byVariant = new Map<string, typeof rows>();
    for (const row of rows) {
      const group = byVariant.get(row.variantId);
      if (group) group.push(row);
      else byVariant.set(row.variantId, [row]);
    }
    const conflicts: {
      transactionId: string;
      overdueTransactionIds: string[];
    }[] = [];
    for (const row of rows) {
      if (!row.startDate || !row.endDate || row.endDate < now) continue;
      // Reuse the stock calculation over one snapshot instead of querying
      // the same variant and reservations again for each transaction.
      const { peak, overdueIds } = occupancy(
        byVariant.get(row.variantId)!, row.startDate, row.endDate, now,
      );
      if (peak > row.variant.quantity)
        conflicts.push({
          transactionId: row.id,
          overdueTransactionIds: overdueIds,
        });
    }
    return {
      conflicts,
      overdue: rows
        .filter((row) => row.pickedUpAt && row.endDate && row.endDate < now)
        .map((row) => row.id),
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
