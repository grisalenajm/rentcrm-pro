import { IsString, IsInt, IsOptional, IsDecimal, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePropertyDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  province: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  rooms: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxGuests?: number;

  @IsOptional()
  @Type(() => Number)
  pricePerNight?: number;

  @IsOptional()
  @IsIn(['active', 'maintenance', 'inactive'])
  status?: string;

  @IsOptional()
  @IsString()
  sesCodigoEstablecimiento?: string;

  @IsOptional()
  @IsString()
  photo?: string;
}
