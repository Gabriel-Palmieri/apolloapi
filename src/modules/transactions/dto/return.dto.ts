import { IsString, MaxLength, ValidateIf } from 'class-validator';

export class ReturnDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  damageNotes?: string;
}
