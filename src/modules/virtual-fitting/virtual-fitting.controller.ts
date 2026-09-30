import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/access.decorator.js';
import {
  VirtualFittingService,
  type FittingImage,
} from './virtual-fitting.service.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

@ApiTags('Virtual Fitting')
@Controller('virtual-fitting')
export class VirtualFittingController {
  constructor(private readonly service: VirtualFittingService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post(':productId')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo', 'garment', 'consent'],
      properties: {
        photo: { type: 'string', format: 'binary', description: 'Foto da pessoa, até 10 MB.' },
        garment: { type: 'string', format: 'binary', description: 'Foto do traje, até 10 MB.' },
        consent: { type: 'string', enum: ['true'] },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'garment', maxCount: 1 },
      ],
      {
        limits: { fileSize: 10 * 1024 * 1024, files: 2 },
        fileFilter: (_request, file, callback) => {
          if (!allowedTypes.has(file.mimetype))
            return callback(new BadRequestException('Use imagens JPG, PNG ou WebP.'), false);
          callback(null, true);
        },
      },
    ),
  )
  generate(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFiles()
    files: { photo?: FittingImage[]; garment?: FittingImage[] },
    @Body('consent') consent: string,
  ) {
    return this.service.generate(
      productId,
      files?.photo?.[0],
      files?.garment?.[0],
      consent,
    );
  }
}
