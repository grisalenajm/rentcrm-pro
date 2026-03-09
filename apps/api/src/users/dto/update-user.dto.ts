import { IsString, IsEmail, IsIn, MinLength, IsOptional, IsBoolean, Matches } from 'class-validator';

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
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/, {
    message: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un carácter especial',
  })
  password?: string;

  @IsOptional()
  @IsIn(['admin', 'gestor', 'viewer'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
