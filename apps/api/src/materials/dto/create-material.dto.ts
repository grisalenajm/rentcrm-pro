import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber } from 'class-validator';

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['limpieza', 'baño', 'regalos', 'otros'])
  type: string;

  @IsIn(['ud', 'kg', 'g', 'l', 'ml', 'm', 'm2', 'pack', 'caja', 'rollo'])
  unit: string;

  @IsNumber()
  standardPrice: number;

  @IsOptional()
  @IsNumber()
  minStock?: number;
}
