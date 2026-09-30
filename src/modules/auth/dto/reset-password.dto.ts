import { IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(8, 128)
  password: string;
}
