import { pageWindow } from '../../common/utils/page-window.js';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWeddingPackageDto } from './dto/create-wedding-package.dto.js';
import { PageDto } from '../../common/dto/page.dto.js';
import { pagination } from '../../common/utils/pagination.js';
import { parseDay, today } from '../../common/utils/dates.js';

const include = {
  participants: { orderBy: { createdAt: 'asc' as const } },
  baseProduct: { include: { variants: true } },
};

@Injectable()
export class WeddingPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWeddingPackageDto) {
    const eventDate = dto.eventDate === undefined ? null : parseDay(dto.eventDate);
    if (eventDate && eventDate < today())
      throw new BadRequestException('A data do evento deve ser hoje ou depois.');
    if (dto.baseProductId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.baseProductId, active: true },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('Modelo base indisponível.');
    }
    return this.prisma.weddingPackage.create({
      data: {
        coupleNames: dto.coupleNames.trim(),
        eventDate,
        expectedMembers: dto.expectedMembers,
        baseProductId: dto.baseProductId,
        contactName: dto.contactName.trim(),
        contactEmail: dto.contactEmail.trim().toLowerCase(),
        contactPhone: dto.contactPhone.trim(),
        notes: dto.notes?.trim() ?? '',
        participants: {
          create: dto.participants.map((person) => ({
            name: person.name.trim(), role: person.role.trim(),
            size: person.size?.trim() ?? '', notes: person.notes?.trim() ?? '',
          })),
        },
      },
      include,
    });
  }

  readPage(query: PageDto) {
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.weddingPackage.count();
      const meta = pageWindow(total, query);
      const items = await tx.weddingPackage.findMany({ include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (meta.page - 1) * meta.limit, take: meta.limit });
      return { ...meta, items };
    }, { isolationLevel: 'RepeatableRead' });
  }
  read(query: PageDto) {
    return this.prisma.weddingPackage.findMany({
      include,
      orderBy: { createdAt: 'desc' },
      ...pagination(query),
    });
  }
}
