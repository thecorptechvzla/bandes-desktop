export const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super administrador',
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
};

export function roleLabel(role?: string | null): string {
  return (role && ROLE_LABELS[role]) || role || '';
}