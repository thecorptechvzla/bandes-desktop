import type { ModuleId } from '@/types/api';

// Orden de importancia para elegir la ruta por defecto tras iniciar sesión.
const MODULE_PRIORITY: ModuleId[] = [
  'dashboard',
  'clientes',
  'packing',
  'procesos',
  'egresos',
  'reportes',
  'superadmin',
];

// Ruta inicial por módulo. Reportes cae en su primera subpágina.
const MODULE_ROUTES: Record<ModuleId, string> = {
  dashboard: '/dashboard',
  clientes: '/clientes',
  packing: '/packing',
  procesos: '/procesos',
  egresos: '/egresos',
  reportes: '/reportes/packing',
  superadmin: '/superadmin',
};

const MODULE_SEGMENTS: ModuleId[] = [
  'dashboard',
  'clientes',
  'packing',
  'procesos',
  'egresos',
  'superadmin',
];

// Primera ruta permitida según los módulos del usuario, en orden de importancia.
export function firstAllowedRoute(allowedModules?: ModuleId[]): string {
  for (const m of MODULE_PRIORITY) {
    if (allowedModules?.includes(m)) return MODULE_ROUTES[m];
  }
  return '/dashboard'; // fallback final (sesión sin módulos)
}

// Módulo requerido por una ruta. `/` y `/dashboard` → dashboard.
// `/historicos/*` se trata como reportes (trazabilidad histórica).
export function moduleForPath(pathname: string): ModuleId | null {
  const seg = pathname.split('/')[1] || 'dashboard';
  if (seg === 'historicos' || seg === 'reportes') return 'reportes';
  if ((MODULE_SEGMENTS as string[]).includes(seg)) return seg as ModuleId;
  return null; // rutas desconocidas (login, not-found, etc.)
}
