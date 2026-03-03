import { IsString, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsIn(['vacacional', 'larga_estancia', 'temporada', 'otro'])
  type: string;

  @IsString()
  content: string;

  @IsString()
  ownerName: string;

  @IsString()
  ownerNif: string;

  @IsOptional()
  @IsString()
  ownerAddress?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  depositAmount?: number;

  @IsOptional()
  @IsString()
  clauses?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
