import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public, Admin } from '../../common/decorators/access.decorator.js';
import { PageDto } from '../../common/dto/page.dto.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { AvailabilityDto } from './dto/availability.dto.js';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Public()
  @Get()
  read(@Query() query: PageDto) {
    return this.service.read(query);
  }

  @Admin()
  @Get('admin/all')
  readIncludingInactive(@Query() query: PageDto) {
    return this.service.read(query, true);
  }

  @Public()
  @Get(':id')
  readOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.readOne(id);
  }

  @Public()
  @Get(':id/variants/:variantId/availability')
  readAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Query() query: AvailabilityDto,
  ) {
    return this.service.readAvailability(
      id,
      variantId,
      query.startDate,
      query.endDate,
    );
  }

  @Admin()
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Admin()
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(id, dto);
  }

  @Admin()
  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }
}
