import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { MODULE_IDS } from '../../../common/constants/modules.js';

export class CreateUserDto {
  @IsString()
  @Length(3, 50, { message: 'El username debe tener entre 3 y 50 caracteres' })
  username: string;

  @IsString()
  @Length(6, 100, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsUUID(undefined, { message: 'roleId inválido' })
  roleId: string;

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
