import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';

export class CreateBookingGuestSesDto {
  @IsIn(['dni', 'passport', 'nie', 'other'])
  docType: string;

  @IsString()
  docNumber: string;

  @IsString()
  docCountry: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
