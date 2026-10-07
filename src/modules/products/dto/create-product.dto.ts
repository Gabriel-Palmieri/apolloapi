import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { VariantDto } from './variant.dto.js';
import { IsProductPhotoUrl } from '../../../common/validators/product-photo-url.js';

export class CreateProductDto {
  @IsString()
  @Length(2, 120)
  @Matches(/\S/)
  name: string;

  @IsString()
  @Length(1, 60)
  category: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 80)
  collection?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 80)
  fabric?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 80)
  color?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 80)
  line?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsProductPhotoUrl()
  photoUrl?: string;

  @IsInt()
  @Min(0)
  @Max(100000000)
  rentalPriceCents: number;

  @IsInt()
  @Min(0)
  @Max(100000000)
  salePriceCents: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants: VariantDto[];
}
