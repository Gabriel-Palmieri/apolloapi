import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWeddingPackageDto } from './dto/create-wedding-package.dto.js';
import { PageDto } from '../../common/dto/page.dto.js';
import { pagination } from '../../common/utils/pagination.js';

const include = {
  participants: { orderBy: { createdAt: 'asc' as const } },
  baseProduct: { include: { variants: true } },
};

@Injectable()
export class WeddingPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWeddingPackageDto) {
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
        eventDate: dto.eventDate ? new Date(`${dto.eventDate}T00:00:00.000Z`) : null,
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

  read(query: PageDto) {
    return this.prisma.weddingPackage.findMany({
      include,
      orderBy: { createdAt: 'desc' },
      ...pagination(query),
    });
  }
}
