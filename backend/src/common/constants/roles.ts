export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
}

export const VALID_USER_ROLES = [UserRole.SUPERADMIN, UserRole.OWNER, UserRole.ADMIN];

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