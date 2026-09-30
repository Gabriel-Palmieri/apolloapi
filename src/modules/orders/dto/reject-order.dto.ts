import { IsString, Length, Matches } from 'class-validator';

export class RejectOrderDto {
  @IsString()
  @Length(3, 1000)
  @Matches(/\S/)
  reason: string;
}
