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

// Fallback cuando el usuario aún no tiene roleId (migración en curso): el
// SUPERADMIN legacy ve todo, el resto ve todo salvo el módulo de Sistema.
const ALL_MODULES = [
  'dashboard',
  'clientes',
  'packing',
  'procesos',
  'egresos',
  'reportes',
  'superadmin',
];

export function resolveAllowedModules(
  legacyRole?: string | null,
  roleAllowed?: string[] | null,
): string[] {
  if (roleAllowed && roleAllowed.length > 0) return roleAllowed;
  if (legacyRole === UserRole.SUPERADMIN) return [...ALL_MODULES];
  return ALL_MODULES.filter((m) => m !== 'superadmin');
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
  if (isSuperadmin) return [...ALL_MODULES];

  const custom = (ctx.customModules ?? []).filter(
    (m) => ALL_MODULES.includes(m) && m !== 'superadmin',
  );
  if (custom.length > 0) return custom;

  if (ctx.roleRefAllowed && ctx.roleRefAllowed.length > 0) {
    return ctx.roleRefAllowed;
  }
  return resolveAllowedModules(ctx.role);
}
