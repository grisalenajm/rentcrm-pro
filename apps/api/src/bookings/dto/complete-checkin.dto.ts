import {
  IsString, IsOptional, IsIn, MaxLength, IsArray, ValidateNested, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

const DOC_TYPES = ['dni', 'passport', 'nie', 'other'] as const;

class GuestDto {
  @IsString() @MaxLength(100) firstName: string;
  @IsString() @MaxLength(100) lastName: string;
  @IsIn(DOC_TYPES) docType: string;
  @IsString() @MaxLength(50) docNumber: string;
  @IsString() @MaxLength(5) docCountry: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @MaxLength(200) street?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(100) province?: string;
  @IsOptional() @IsString() @MaxLength(5) country?: string;
}

export class CompleteCheckinDto {
  @IsString() @MaxLength(100) firstName: string;
  @IsString() @MaxLength(100) lastName: string;
  @IsIn(DOC_TYPES) docType: string;
  @IsString() @MaxLength(50) docNumber: string;
  @IsString() @MaxLength(5) docCountry: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) street?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(100) province?: string;
  @IsOptional() @IsString() @MaxLength(5) country?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GuestDto) guests?: GuestDto[];
}
