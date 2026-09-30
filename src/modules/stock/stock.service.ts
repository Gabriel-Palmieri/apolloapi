import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { occupancy } from './availability.js';
import { today } from '../../common/utils/dates.js';
@Injectable()
export class StockService {
  async availability(
    tx: Prisma.TransactionClient,
    variantId: string,
    from: Date,
    to: Date | null,
    excludeId?: string,
  ) {
    const variant = await tx.variant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant) throw new NotFoundException('Tamanho não encontrado.');
    const rows = await tx.transaction.findMany({
      where: {
        variantId,
        type: 'RENTAL',
        status: 'CONFIRMED',
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    const { peak, overdueIds } = occupancy(rows, from, to, today());
    return {
      quantity: variant.quantity,
      reserved: peak,
      available: Math.max(0, variant.quantity - peak),
      hasConflict: peak > variant.quantity,
      overdueTransactionIds: overdueIds,
      active: variant.product.active,
    };
  }
}
