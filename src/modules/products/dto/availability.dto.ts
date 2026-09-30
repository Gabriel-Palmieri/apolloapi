import { IsString } from 'class-validator';

export class AvailabilityDto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}
