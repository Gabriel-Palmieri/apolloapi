import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Admin,
  CurrentUser,
} from '../../common/decorators/access.decorator.js';
import type { Profile } from '../../generated/prisma/client.js';
import { PageDto } from '../../common/dto/page.dto.js';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { RejectOrderDto } from './dto/reject-order.dto.js';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  read(@CurrentUser() user: Profile, @Query() query: PageDto) {
    return this.service.read(user, query);
  }

  @Get(':id')
  readOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Profile,
  ) {
    return this.service.readOne(id, user);
  }

  @Post()
  create(@CurrentUser() user: Profile, @Body() dto: CreateOrderDto) {
    return this.service.create(user, dto);
  }

  @Admin()
  @Post(':id/review')
  review(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.transition(id, 'review');
  }

  @Admin()
  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.transition(id, 'approve');
  }

  @Admin()
  @Post(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectOrderDto) {
    return this.service.transition(id, 'reject', dto.reason);
  }
}
