import { ListPageDto } from '../../common/dto/list-page.dto.js';
import { pageWindow } from '../../common/utils/page-window.js';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Admin } from '../../common/decorators/access.decorator.js';
import { PageDto } from '../../common/dto/page.dto.js';
import { pagination } from '../../common/utils/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
@ApiTags('Profiles')
@ApiBearerAuth()
@Admin()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('page')
  readPage(@Query() query: ListPageDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const where = {
          role: 'CLIENT' as const,
          ...(query.q?.trim()
            ? {
                OR: [
                  {
                    name: {
                      contains: query.q.trim(),
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    email: {
                      contains: query.q.trim(),
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : {}),
        };
        const total = await tx.profile.count({ where });
        const meta = pageWindow(total, query);
        const items = await tx.profile.findMany({
          where,
          select: { id: true, name: true, email: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (meta.page - 1) * meta.limit,
          take: meta.limit,
        });
        return { ...meta, items };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  @Get()
  read(@Query() query: PageDto) {
    return this.prisma.profile.findMany({
      where: { role: 'CLIENT' },
      orderBy: { createdAt: 'desc' },
      ...pagination(query),
    });
  }
}
