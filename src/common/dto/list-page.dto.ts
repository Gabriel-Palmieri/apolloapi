import { IsIn, IsDateString, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PageDto } from './page.dto.js';

export class ListPageDto extends PageDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  q?: string;
}
export class ProductPageDto extends ListPageDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['all', 'active', 'inactive'])
  state?: 'all' | 'active' | 'inactive';
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['Terno', 'Vestido', 'Sapato', 'Gravata', 'Camisa', 'Acessório'])
  category?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['todos', 'noivo', 'padrinhos', 'convidado', 'acessorios'])
  showcase?: string;
}
export class OrderPageDto extends PageDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(64)
  protocol?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'])
  @IsString()
  status?: 'NEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
}
export class CalendarDto {
  @IsDateString({ strict: true })
  start!: string;
  @IsDateString({ strict: true })
  end!: string;
}
export class TransactionPageDto extends ListPageDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsDateString({ strict: true })
  day?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['date', 'recent'])
  sort?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['RENTAL', 'SALE'])
  type?: 'RENTAL' | 'SALE';
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])
  status?: 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}
