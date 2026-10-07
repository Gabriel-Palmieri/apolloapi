
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Admin, Public } from '../../common/decorators/access.decorator.js';
import { PageDto } from '../../common/dto/page.dto.js';
import { CreateWeddingPackageDto } from './dto/create-wedding-package.dto.js';
import { WeddingPackagesService } from './wedding-packages.service.js';

@ApiTags('Wedding Packages')
@ApiBearerAuth()
@Controller('wedding-packages')
export class WeddingPackagesController {
  constructor(private readonly service: WeddingPackagesService) {}

  @Public()
  @Post()
  create(@Body() dto: CreateWeddingPackageDto) {
    return this.service.create(dto);
  }

  @Admin()
  @Get('page')
  readPage(@Query() query: PageDto) {
    return this.service.readPage(query);
  }
  @Admin()
  @Get()
  read(@Query() query: PageDto) {
    return this.service.read(query);
  }
}
