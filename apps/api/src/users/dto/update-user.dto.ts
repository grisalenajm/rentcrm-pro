import { IsString, IsEmail, IsIn, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(['admin', 'gestor', 'viewer'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
