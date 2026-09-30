import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

export class VariantDto {
  @IsString()
  @Length(1, 20)
  @Matches(/\S/)
  size: string;

  @IsInt()
  @Min(0)
  @Max(100000)
  quantity: number;
}
