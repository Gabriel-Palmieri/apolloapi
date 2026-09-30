import { IsString, Length, Matches } from 'class-validator';
import { LoginDto } from './login.dto.js';

export class RegisterDto extends LoginDto {
  @IsString()
  @Length(2, 100)
  @Matches(/\S/)
  name: string;
}
