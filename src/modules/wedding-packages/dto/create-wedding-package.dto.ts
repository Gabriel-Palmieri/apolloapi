import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsDateString,
  Matches,
  ValidateIf,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ParticipantDto {
  @IsString() @Length(2, 100) name: string;
  @IsString() @Length(2, 40) role: string;
  @IsOptional() @IsString() @MaxLength(10) size?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateWeddingPackageDto {
  @IsString() @Length(2, 150) coupleNames: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  eventDate?: string;
  @IsInt() @Min(1) @Max(30) expectedMembers: number;
  @IsOptional() @IsUUID() baseProductId?: string;
  @IsString() @Length(2, 100) contactName: string;
  @IsEmail() @MaxLength(254) contactEmail: string;
  @IsString() @Length(8, 25) contactPhone: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ParticipantDto)
  participants: ParticipantDto[];
}
