import { IsEmail, MaxLength } from 'class-validator';

export class RecoverDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
