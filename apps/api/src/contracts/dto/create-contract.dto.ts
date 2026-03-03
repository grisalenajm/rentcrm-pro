import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContractDto {
  @IsString()
  bookingId: string;

  @IsString()
  templateId: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  depositAmount?: number;
}
