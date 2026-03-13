import { IsString, IsOptional } from 'class-validator';

export class UpsertContentDto {
  @IsOptional()
  @IsString()
  houseRules?: string;

  @IsOptional()
  @IsString()
  arrivalGuide?: string;

  @IsOptional()
  @IsString()
  localInfo?: string;
}
