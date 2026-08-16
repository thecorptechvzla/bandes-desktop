import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 50, { message: 'El username debe tener entre 3 y 50 caracteres' })
  username?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'roleId inválido' })
  roleId?: string;

  @IsOptional()
  @IsString()
  @Length(6, 100, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}