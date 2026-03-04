import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEvaluationDto {
  @IsString()
  bookingId: string;

  @IsString()
  clientId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  score: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
