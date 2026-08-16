import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { isValidModuleId } from '../../../common/constants/modules.js';

export class CreateRoleDto {
  @IsString()
  @Length(3, 50, { message: 'El nombre del rol debe tener entre 3 y 50 caracteres' })
  @Matches(/^[A-Za-z0-9_\- ]+$/, { message: 'Nombre inválido (solo letras, números, guiones y espacios)' })
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'La descripción no puede superar los 200 caracteres' })
  description?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un módulo' })
  @ArrayMaxSize(7)
  @IsString({ each: true })
  allowedModules: string[];
}

export function validateModules(modules: string[]): boolean {
  return modules.every((m) => isValidModuleId(m));
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(3, 50, { message: 'El nombre del rol debe tener entre 3 y 50 caracteres' })
  @Matches(/^[A-Za-z0-9_\- ]+$/, { message: 'Nombre inválido (solo letras, números, guiones y espacios)' })
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'La descripción no puede superar los 200 caracteres' })
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un módulo' })
  @ArrayMaxSize(7)
  @IsString({ each: true })
  allowedModules?: string[];
}

export class RoleIdParamDto {
  @IsUUID(undefined, { message: 'Id de rol inválido' })
  id: string;
}