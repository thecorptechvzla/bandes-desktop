import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { MODULE_IDS } from '../../../common/constants/modules.js';

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

  // Override opcional de permisos: [] o ausente => hereda del rol.
  @IsOptional()
  @IsArray({ message: 'customModules debe ser un arreglo' })
  @ArrayMaxSize(MODULE_IDS.length, {
    message: 'customModules no puede superar los módulos existentes',
  })
  @IsString({ each: true })
  @IsIn(MODULE_IDS, {
    each: true,
    message: 'Módulo personalizado inválido',
  })
  customModules?: string[];
}
