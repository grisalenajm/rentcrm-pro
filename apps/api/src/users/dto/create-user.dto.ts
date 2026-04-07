import { IsString, IsEmail, IsIn, MinLength, IsOptional, Matches } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/, {
    message: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un carácter especial',
  })
  password: string;

  @IsIn(['admin', 'gestor', 'owner', 'inventario', 'viewer'])
  role: string;
}
