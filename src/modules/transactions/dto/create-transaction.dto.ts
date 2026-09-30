import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { OperationType } from '../../../generated/prisma/enums.js';

export class CreateTransactionDto {
  @IsUUID()
  profileId: string;

  @IsUUID()
  variantId: string;

  @IsEnum(OperationType)
  type: OperationType;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100000000)
  priceCents?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  startDate?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  endDate?: string;
}
