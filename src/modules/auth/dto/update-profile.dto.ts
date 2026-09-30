import { IsString, Length, Matches, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(2, 100)
  @Matches(/\S/)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(8, 25)
  phone?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/^(\d{11}|\d{14})$/)
  document?: string;
}
