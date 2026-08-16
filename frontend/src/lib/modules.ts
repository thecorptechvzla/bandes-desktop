import type { ModuleId } from '@/types/api';

export const MODULES: { id: ModuleId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clientes', label: 'Proveedores' },
  { id: 'packing', label: 'Packing' },
  { id: 'procesos', label: 'Procesos' },
  { id: 'egresos', label: 'Egresos' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'superadmin', label: 'Sistema' },
];