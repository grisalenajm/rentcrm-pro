import { IsString, IsOptional } from 'class-validator';

export class UpsertContentDto {
  @IsOptional()
  @IsString()
  template?: string;
}
