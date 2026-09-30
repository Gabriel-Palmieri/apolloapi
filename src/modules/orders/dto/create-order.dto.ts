import {
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { OperationType } from '../../../generated/prisma/enums.js';

export class CreateOrderDto {
  @IsUUID()
  variantId: string;

  @IsEnum(OperationType)
  type: OperationType;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  startDate?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  endDate?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
