// Ids de módulos del sidebar. Minúsculas y = a los ids del menú frontend,
// para que el gating sea un `includes()` directo sin mapeo.
export const MODULE_IDS = [
  'dashboard',
  'clientes',
  'packing',
  'procesos',
  'egresos',
  'reportes',
  'superadmin',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export function isValidModuleId(value: string): boolean {
  return (MODULE_IDS as readonly string[]).includes(value);
}