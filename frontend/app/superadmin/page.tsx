'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert, Users as UsersIcon, Database, Plus,
  Trash2, Loader2,
} from 'lucide-react';
import { getSession } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import {
  useSuperadminUsers,
  useCreateSuperadminUser,
  useDeleteSuperadminUser,
} from '@/hooks/useSuperadminUsers';
import type { User, UserRole } from '@/types/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UserFormModal } from '@/components/superadmin/UserFormModal';
import { DangerZone } from '@/components/superadmin/DangerZone';

type Tab = 'users' | 'database';

const ROLE_STYLES: Record<UserRole, { color: string; bg: string; border: string }> = {
  SUPERADMIN: { color: 'var(--pm-accent-gold)', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.35)' },
  OWNER: { color: 'var(--pm-accent-cyan)', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)' },
  ADMIN: { color: 'var(--pm-accent-emerald)', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
};

const TH = 'text-[10px] text-[var(--pm-text-dim)] font-mono font-bold uppercase tracking-widest';

function SkeletonRows() {
  return (
    <tbody>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--pm-border)]/50">
          <td className="pl-6 py-3.5"><div className="skeleton h-4 w-32 rounded" /></td>
          <td className="px-4 py-3.5"><div className="skeleton h-5 w-24 rounded mx-auto" /></td>
          <td className="px-4 py-3.5 hidden sm:table-cell"><div className="skeleton h-4 w-20 rounded mx-auto" /></td>
          <td className="px-4 py-3.5 hidden md:table-cell"><div className="skeleton h-4 w-28 rounded" /></td>
          <td className="pr-6 py-3.5"><div className="skeleton h-4 w-8 rounded ml-auto" /></td>
        </tr>
      ))}
    </tbody>
  );
}

export default function SuperadminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('users');
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data: users = [], isLoading, isError, error } = useSuperadminUsers();
  const createUser = useCreateSuperadminUser();
  const deleteUser = useDeleteSuperadminUser();

  useEffect(() => {
    const session = getSession();
    const ok = session?.role === 'SUPERADMIN';
    setAllowed(ok);
    if (!ok) router.replace('/dashboard');
  }, [router]);

  const currentUserId = getSession()?.id;

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--pm-accent-emerald)]" />
      </div>
    );
  }

  if (allowed === false) return null;

  const handleCreate = async (data: { username: string; password: string; role: UserRole }) => {
    await createUser.mutateAsync(data);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteUser.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* ═══ HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <ShieldAlert className="w-4 h-4 text-[var(--pm-accent-red)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--pm-text-primary)] font-sans tracking-tight">
              Sistema (God Mode)
            </h1>
            <p className="text-[11px] text-[var(--pm-text-dim)] font-mono uppercase tracking-wider mt-0.5">
              Consola de administración exclusiva
            </p>
          </div>
        </div>
        {tab === 'users' && (
          <button
            onClick={() => setShowModal(true)}
            className="premium-card px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-wider font-bold flex items-center gap-2 active:scale-95 transition-all duration-150 cursor-pointer hover:border-[var(--pm-accent-emerald)]/40"
            style={{ borderColor: 'rgba(16,185,129,0.25)' }}
          >
            <Plus className="w-3.5 h-3.5 text-[var(--pm-accent-emerald)]" />
            <span style={{ color: 'var(--pm-accent-emerald)' }}>Nuevo Usuario</span>
          </button>
        )}
      </motion.div>

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1 p-1 rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg-deepest)]/60 w-fit">
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
            tab === 'users'
              ? 'text-[var(--pm-accent-emerald)]'
              : 'text-[var(--pm-text-dim)] hover:text-[var(--pm-text-primary)]'
          }`}
          style={tab === 'users' ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' } : { border: '1px solid transparent' }}
        >
          <UsersIcon className="w-3.5 h-3.5" />
          Gestión de Usuarios
        </button>
        <button
          type="button"
          onClick={() => setTab('database')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
            tab === 'database'
              ? 'text-[var(--pm-accent-red)]'
              : 'text-[var(--pm-text-dim)] hover:text-[var(--pm-text-primary)]'
          }`}
          style={tab === 'database' ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' } : { border: '1px solid transparent' }}
        >
          <Database className="w-3.5 h-3.5" />
          Base de Datos (Zona de Peligro)
        </button>
      </div>

      {tab === 'users' && (
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
                    <th className={`w-[30%] text-left pl-6 py-3 ${TH}`}>Usuario</th>
                    <th className={`w-[15%] text-center px-4 py-3 ${TH}`}>Rol</th>
                    <th className={`w-[15%] text-center px-4 py-3 hidden sm:table-cell ${TH}`}>Estado</th>
                    <th className={`w-[20%] text-left px-4 py-3 hidden md:table-cell ${TH}`}>Creado</th>
                    <th className={`w-[15%] text-right pr-6 py-3 ${TH}`}>Acciones</th>
                  </tr>
                </thead>
                <SkeletonRows />
              </table>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--pm-accent-red)]">
              <span className="text-sm font-sans">Error al cargar los usuarios</span>
              <span className="text-xs text-[var(--pm-text-dim)] mt-1">
                {(error as any)?.message || 'Error de conexión'}
              </span>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--pm-text-dim)]">
              <UsersIcon className="w-10 h-10 text-[var(--pm-accent-gold)]/20 mb-3 animate-pulse" />
              <span className="text-sm font-sans">No hay usuarios registrados</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-[var(--pm-border)]">
                    <th className={`w-[30%] text-left pl-6 py-3 ${TH}`}>Usuario</th>
                    <th className={`w-[15%] text-center px-4 py-3 ${TH}`}>Rol</th>
                    <th className={`w-[15%] text-center px-4 py-3 hidden sm:table-cell ${TH}`}>Estado</th>
                    <th className={`w-[20%] text-left px-4 py-3 hidden md:table-cell ${TH}`}>Creado</th>
                    <th className={`w-[15%] text-right pr-6 py-3 ${TH}`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const s = ROLE_STYLES[user.role];
                    const isSelf = user.id === currentUserId;
                    return (
                      <tr key={user.id} className="border-b border-[var(--pm-border)]/50 hover:bg-[var(--pm-bg-tertiary)]/40 transition-colors">
                        <td className="pl-6 py-3.5">
                          <span className="font-mono font-bold text-[var(--pm-text-primary)]">
                            {user.username}
                          </span>
                          {isSelf && (
                            <span className="ml-2 text-[9px] font-mono uppercase tracking-wider text-[var(--pm-accent-gold)]">
                              (tú)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border"
                            style={{ color: s.color, background: s.bg, borderColor: s.border }}
                          >
                            {roleLabel(user.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center hidden sm:table-cell">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider ${user.active ? 'text-[var(--pm-accent-emerald)]' : 'text-[var(--pm-accent-red)]'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.active ? 'bg-[var(--pm-accent-emerald)]' : 'bg-[var(--pm-accent-red)]'}`} />
                            {user.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell text-[var(--pm-text-dim)] font-mono">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="pr-6 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(user)}
                            disabled={isSelf}
                            title={isSelf ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
                            className="p-1.5 rounded-lg text-[var(--pm-text-dim)] hover:text-[var(--pm-accent-red)] hover:bg-[var(--pm-accent-red)]/10 transition-all active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {tab === 'database' && <DangerZone />}

      {/* ═══ NEW USER MODAL ═══ */}
      <UserFormModal
        isOpen={showModal}
        isPending={createUser.isPending}
        onSubmit={handleCreate}
        onClose={() => setShowModal(false)}
      />

      {/* ═══ DELETE CONFIRM ═══ */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        icon={<Trash2 className="w-4 h-4 text-[var(--pm-accent-red)]" />}
        title="Eliminar Usuario"
        description={deleteTarget?.username}
        confirmLabel="Eliminar"
        confirmIcon={<Trash2 className="w-3.5 h-3.5" />}
        variant="danger"
        loading={deleteUser.isPending}
      >
        <div className="p-3 rounded-lg border" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <p className="text-[11px] font-mono text-[var(--pm-accent-red)] leading-relaxed">
            El usuario <b>{deleteTarget?.username}</b> ({deleteTarget ? roleLabel(deleteTarget.role) : ''}) se eliminará de forma permanente. Esta acción no se puede deshacer.
          </p>
        </div>
      </ConfirmDialog>
    </motion.div>
  );
}