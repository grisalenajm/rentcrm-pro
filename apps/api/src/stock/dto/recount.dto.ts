import { IsString, IsNotEmpty, IsNumber, Min, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class RecountItemDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsNumber()
  @Min(0)
  quantity: number;
}

export class RecountDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecountItemDto)
  items: RecountItemDto[];

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  propertyId?: string;
}
