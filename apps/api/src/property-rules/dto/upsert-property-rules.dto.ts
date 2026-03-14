import { IsString, IsOptional, IsObject, IsArray } from 'class-validator';

export class UpsertPropertyRulesDto {
  @IsString()
  baseContent: string;

  @IsOptional()
  @IsString()
  baseLanguage?: string;

  @IsOptional()
  @IsObject()
  translations?: Record<string, string>;

  @IsOptional()
  @IsArray()
  translationsEdited?: string[];
}
