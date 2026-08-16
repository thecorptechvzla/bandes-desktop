import { IsEnum, IsString, Length } from 'class-validator';
import { UserRole } from '../../../common/constants/roles.js';

export class CreateUserDto {
  @IsString()
  @Length(3, 50, { message: 'El username debe tener entre 3 y 50 caracteres' })
  username: string;

  @IsString()
  @Length(6, 100, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsEnum(UserRole, { message: 'Rol inválido (SUPERADMIN|OWNER|ADMIN)' })
  role: UserRole;
}