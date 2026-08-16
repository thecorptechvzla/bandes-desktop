import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { UserRole } from '../../../common/constants/roles.js';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 50, { message: 'El username debe tener entre 3 y 50 caracteres' })
  username?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Rol inválido (SUPERADMIN|OWNER|ADMIN)' })
  role?: UserRole;

  @IsOptional()
  @IsString()
  @Length(6, 100, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}