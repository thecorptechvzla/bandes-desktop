import { MODULE_IDS } from './modules.js';

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
}

export const VALID_USER_ROLES = [
  UserRole.SUPERADMIN,
  UserRole.OWNER,
  UserRole.ADMIN,
];

// Módulos que ve el SUPERADMIN: el dashboard gerencial/financiero queda
// exclusivo de roles gerenciales; "mi-panel" es la pantalla del operador.
const SUPERADMIN_MODULES = MODULE_IDS.filter((m) => m !== 'mi-panel');

// Default de usuarios operativos (legacy sin roleId o roles sin allowedModules):
// "mi-panel" primero (su landing), luego todo salvo el módulo de Sistema.
const OPERATIVE_MODULES = [
  'mi-panel',
  ...MODULE_IDS.filter((m) => m !== 'superadmin' && m !== 'mi-panel'),
];

export function resolveAllowedModules(
  legacyRole?: string | null,
  roleAllowed?: string[] | null,
): string[] {
  if (roleAllowed && roleAllowed.length > 0) return roleAllowed;
  if (legacyRole === UserRole.SUPERADMIN) return [...SUPERADMIN_MODULES];
  return [...OPERATIVE_MODULES];
}

export interface UserModuleContext {
  role?: string | null;
  roleRefName?: string | null;
  roleRefAllowed?: string[] | null;
  customModules?: string[] | null;
}

// Resolución final de módulos para un usuario (modelo híbrido):
// 1. SUPERADMIN siempre ve todo (por rol legacy o roleRef), sin importar nada.
// 2. Si tiene customModules (override), mandan esos (filtrado defensivo).
// 3. Si no, hereda los allowedModules de su Role.
// 4. Fallback legacy (usuarios aún sin roleId).
export function resolveUserModules(ctx: UserModuleContext): string[] {
  const isSuperadmin =
    ctx.role === UserRole.SUPERADMIN || ctx.roleRefName === UserRole.SUPERADMIN;
  if (isSuperadmin) return [...SUPERADMIN_MODULES];

  const custom = (ctx.customModules ?? []).filter(
    (m) => (MODULE_IDS as readonly string[]).includes(m) && m !== 'superadmin',
  );
  if (custom.length > 0) return custom;

  if (ctx.roleRefAllowed && ctx.roleRefAllowed.length > 0) {
    return ctx.roleRefAllowed;
  }
  return resolveAllowedModules(ctx.role);
}
