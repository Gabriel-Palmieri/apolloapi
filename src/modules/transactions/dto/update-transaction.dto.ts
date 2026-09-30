import { IsInt, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class UpdateTransactionDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  variantId?: string;

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
