import { IsString, IsOptional, IsNumber, IsInt, Min } from 'class-validator';

export class AddDocumentDto {
  @IsString()
  name: string;

  @IsString()
  fileData: string;

  @IsInt()
  @Min(0)
  fileSize: number;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
