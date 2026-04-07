import { IsString, IsNotEmpty, IsIn, IsNumber, IsOptional } from 'class-validator';

export class CreateStockMovementDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsIn(['entrada', 'salida', 'recuento'])
  type: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  @IsOptional()
  unitPrice?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
