import { OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { CreateProductDto } from './create-product.dto.js';
import { IsProductPhotoUrl } from '../../../common/validators/product-photo-url.js';

// PATCH distinguishes omitted values (keep) from null (clear nullable fields).
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['collection', 'fabric', 'color', 'line', 'photoUrl'] as const),
  { skipNullProperties: false },
) {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  collection?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  fabric?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  color?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  line?: string | null;

  @IsOptional()
  @IsProductPhotoUrl()
  photoUrl?: string | null;
}
