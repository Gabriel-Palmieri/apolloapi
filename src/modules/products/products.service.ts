import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from '../stock/stock.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { PageDto } from '../../common/dto/page.dto.js';
import { pagination } from '../../common/utils/pagination.js';
import { parseDay, today } from '../../common/utils/dates.js';
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  read(query: PageDto, includeInactive = false) {
    return this.prisma.product.findMany({
      where: includeInactive ? {} : { active: true },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
      ...pagination(query),
    });
  }

  async readOne(id: string, includeInactive = false) {
    const product = await this.prisma.product.findFirst({
      where: { id, ...(includeInactive ? {} : { active: true }) },
      include: { variants: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  private assertSizes(variants: { size: string }[]) {
    if (new Set(variants.map((v) => v.size)).size !== variants.length)
      throw new ConflictException('Tamanhos duplicados.');
  }

  create(dto: CreateProductDto) {
    this.assertSizes(dto.variants);
    const { variants, ...data } = dto;
    return this.prisma.product.create({
      data: { ...data, variants: { create: variants } },
      include: { variants: true },
    });
  }

  update(id: string, dto: UpdateProductDto) {
    return this.prisma.atomic(async (tx) => {
      if (!(await tx.product.findUnique({ where: { id } })))
        throw new NotFoundException('Produto não encontrado.');
      const { variants, ...data } = dto;
      if (variants) {
        this.assertSizes(variants);
        for (const input of variants) {
          const variant = await tx.variant.findUnique({
            where: { productId_size: { productId: id, size: input.size } },
          });
          if (variant) {
            const use = await this.stock.availability(
              tx,
              variant.id,
              today(),
              null,
            );
            if (input.quantity < use.reserved)
              throw new ConflictException(
                'Quantidade menor que as reservas existentes.',
              );
            await tx.variant.update({
              where: { id: variant.id },
              data: { quantity: input.quantity },
            });
          } else await tx.variant.create({ data: { ...input, productId: id } });
        }
      }
      return tx.product.update({
        where: { id },
        data,
        include: { variants: true },
      });
    });
  }

  async deactivate(id: string) {
    await this.readOne(id, true);
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }

  async readAvailability(
    id: string,
    variantId: string,
    start: string,
    end: string,
  ) {
    const product = await this.readOne(id);
    if (!product.variants.some((v) => v.id === variantId))
      throw new NotFoundException('Tamanho não encontrado neste produto.');
    const from = parseDay(start),
      to = parseDay(end);
    if (to < from) throw new ConflictException('Período inválido.');
    const result = await this.stock.availability(
      this.prisma,
      variantId,
      from,
      to,
    );
    // Public catalogue does not expose identifiers of customer transactions.
    return {
      quantity: result.quantity,
      reserved: result.reserved,
      available: result.available,
      hasConflict: result.hasConflict,
    };
  }
}
