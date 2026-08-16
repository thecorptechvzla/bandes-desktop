'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Shield, Trash2, Pencil, Loader2, Lock } from 'lucide-react';
import type { Role } from '@/types/api';
import { MODULES } from '@/lib/modules';

const TH = 'text-[10px] text-[var(--pm-text-dim)] font-mono font-bold uppercase tracking-widest';

function SkeletonRows() {
  return (
    <tbody>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--pm-border)]/50">
          <td className="pl-6 py-3.5"><div className="skeleton h-4 w-28 rounded" /></td>
          <td className="px-4 py-3.5 hidden sm:table-cell"><div className="skeleton h-4 w-40 rounded" /></td>
          <td className="px-4 py-3.5"><div className="skeleton h-4 w-44 rounded" /></td>
          <td className="px-4 py-3.5 hidden md:table-cell"><div className="skeleton h-4 w-10 rounded mx-auto" /></td>
          <td className="pr-6 py-3.5"><div className="skeleton h-4 w-8 rounded ml-auto" /></td>
        </tr>
      ))}
    </tbody>
  );
}

interface RolesManagerProps {
  roles: Role[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export function RolesManager({ roles, isLoading, isError, error, onEdit, onDelete }: RolesManagerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="glass-panel overflow-hidden"
    >
      {isLoading ? (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-[var(--pm-border)]">
                <th className={`w-[20%] text-left pl-6 py-3 ${TH}`}>Rol</th>
                <th className={`w-[25%] text-left px-4 py-3 hidden sm:table-cell ${TH}`}>Descripción</th>
                <th className={`w-[35%] text-left px-4 py-3 ${TH}`}>Módulos</th>
                <th className={`w-[10%] text-center px-4 py-3 hidden md:table-cell ${TH}`}>Usuarios</th>
                <th className={`w-[10%] text-right pr-6 py-3 ${TH}`}>Acciones</th>
              </tr>
            </thead>
            <SkeletonRows />
          </table>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--pm-accent-red)]">
          <span className="text-sm font-sans">Error al cargar los roles</span>
          <span className="text-xs text-[var(--pm-text-dim)] mt-1">
            {(error as any)?.message || 'Error de conexión'}
          </span>
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--pm-text-dim)]">
          <Shield className="w-10 h-10 text-[var(--pm-accent-gold)]/20 mb-3 animate-pulse" />
          <span className="text-sm font-sans">No hay roles registrados</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-[var(--pm-border)]">
                <th className={`w-[20%] text-left pl-6 py-3 ${TH}`}>Rol</th>
                <th className={`w-[25%] text-left px-4 py-3 hidden sm:table-cell ${TH}`}>Descripción</th>
                <th className={`w-[35%] text-left px-4 py-3 ${TH}`}>Módulos</th>
                <th className={`w-[10%] text-center px-4 py-3 hidden md:table-cell ${TH}`}>Usuarios</th>
                <th className={`w-[10%] text-right pr-6 py-3 ${TH}`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => (
                <tr key={role.id} className="border-b border-[var(--pm-border)]/50 hover:bg-[var(--pm-bg-tertiary)]/40 transition-colors">
                  <td className="pl-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border"
                        style={{
                          color: 'var(--pm-accent-gold)',
                          background: 'rgba(212,175,55,0.12)',
                          borderColor: role.isSystem ? 'rgba(212,175,55,0.45)' : 'rgba(212,175,55,0.25)',
                        }}
                      >
                        {role.isSystem && <Lock className="w-2.5 h-2.5" />}
                        {role.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell text-[var(--pm-text-dim)] font-mono text-[11px] truncate">
                    {role.description || '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {MODULES.filter(m => role.allowedModules.includes(m.id)).map(m => (
                        <span
                          key={m.id}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider border"
                          style={{ color: 'var(--pm-accent-emerald)', borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.08)' }}
                        >
                          {m.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center hidden md:table-cell font-mono text-[var(--pm-text-dim)]">
                    {role._count?.users ?? 0}
                  </td>
                  <td className="pr-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(role)}
                        title={role.isSystem ? 'Editar rol del sistema (solo descripción)' : 'Editar rol'}
                        className="p-1.5 rounded-lg text-[var(--pm-text-dim)] hover:text-[var(--pm-accent-gold)] hover:bg-[var(--pm-accent-gold)]/10 transition-all active:scale-90 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(role)}
                        disabled={role.isSystem}
                        title={role.isSystem ? 'No puedes eliminar un rol del sistema' : 'Eliminar rol'}
                        className="p-1.5 rounded-lg text-[var(--pm-text-dim)] hover:text-[var(--pm-accent-red)] hover:bg-[var(--pm-accent-red)]/10 transition-all active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}