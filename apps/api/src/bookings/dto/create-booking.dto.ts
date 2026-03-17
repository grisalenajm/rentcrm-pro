import { IsString, IsDateString, IsNumber, IsOptional, IsIn, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BookingGuestDto {
  @IsString()
  clientId: string;

  @IsOptional()
  @IsIn(['primary', 'guest', 'child'])
  role?: string;
}

export class CreateBookingDto {
  @IsString()
  clientId: string;

  @IsString()
  propertyId: string;

  @IsDateString()
  checkInDate: string;

  @IsDateString()
  checkOutDate: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsIn(['created', 'registered', 'processed', 'error', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsIn(['direct', 'airbnb', 'booking', 'vrbo', 'manual_block'])
  source?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingGuestDto)
  guests?: BookingGuestDto[];
}
