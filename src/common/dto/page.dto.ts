import { Type } from 'class-transformer';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export class PageDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
