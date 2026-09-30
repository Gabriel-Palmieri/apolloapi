import { IsString, Length } from 'class-validator';

export class RefreshDto {
  @IsString()
  @Length(1, 4096)
  refreshToken: string;
}
