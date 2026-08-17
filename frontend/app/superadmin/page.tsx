'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert, Users as UsersIcon, Database, Plus,
  Trash2, Loader2, Pencil, Shield,
} from 'lucide-react';
import { getSession } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import { firstAllowedRoute } from '@/lib/routing';
import {
  useSuperadminUsers,
  useCreateSuperadminUser,
  useDeleteSuperadminUser,
  useUpdateSuperadminUser,
} from '@/hooks/useSuperadminUsers';
import {
  useSuperadminRoles,
  useCreateSuperadminRole,
  useUpdateSuperadminRole,
  useDeleteSuperadminRole,
} from '@/hooks/useSuperadminRoles';
import type {
  User, UserRole, UpdateUserRequest, Role, CreateUserRequest,
  CreateRoleRequest, UpdateRoleRequest,
} from '@/types/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UserFormModal } from '@/components/superadmin/UserFormModal';
import { EditUserModal } from '@/components/superadmin/EditUserModal';
import { RoleModal } from '@/components/superadmin/RoleModal';
import { RolesManager } from '@/components/superadmin/RolesManager';
import { DangerZone } from '@/components/superadmin/DangerZone';

type Tab = 'users' | 'roles' | 'database';

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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);

  const { data: users = [], isLoading, isError, error } = useSuperadminUsers();
  const createUser = useCreateSuperadminUser();
  const deleteUser = useDeleteSuperadminUser();
  const updateUser = useUpdateSuperadminUser();

  const {
    data: roles = [],
    isLoading: rolesLoading,
    isError: rolesError,
    error: rolesErr,
  } = useSuperadminRoles();
  const createRole = useCreateSuperadminRole();
  const updateRole = useUpdateSuperadminRole();
  const deleteRole = useDeleteSuperadminRole();

  useEffect(() => {
    const session = getSession();
    const ok = session?.role === 'SUPERADMIN';
    setAllowed(ok);
    if (!ok) router.replace(firstAllowedRoute(session?.allowedModules));
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

  const handleCreate = async (data: CreateUserRequest) => {
    await createUser.mutateAsync(data);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteUser.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleUpdateUser = async (id: string, data: UpdateUserRequest) => {
    await updateUser.mutateAsync({ id, data });
  };

  const handleSaveRole = async (data: CreateRoleRequest | UpdateRoleRequest) => {
    if (editingRole) {
      await updateRole.mutateAsync({ id: editingRole.id, data });
    } else {
      await createRole.mutateAsync(data as CreateRoleRequest);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    await deleteRole.mutateAsync(deleteRoleTarget.id);
    setDeleteRoleTarget(null);
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
        {tab === 'roles' && (
          <button
            onClick={() => {
              setEditingRole(null);
              setShowRoleModal(true);
            }}
            className="premium-card px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-wider font-bold flex items-center gap-2 active:scale-95 transition-all duration-150 cursor-pointer hover:border-[var(--pm-accent-gold)]/40"
            style={{ borderColor: 'rgba(212,175,55,0.25)' }}
          >
            <Plus className="w-3.5 h-3.5 text-[var(--pm-accent-gold)]" />
            <span style={{ color: 'var(--pm-accent-gold)' }}>Nuevo Rol</span>
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
          onClick={() => setTab('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
            tab === 'roles'
              ? 'text-[var(--pm-accent-gold)]'
              : 'text-[var(--pm-text-dim)] hover:text-[var(--pm-text-primary)]'
          }`}
          style={tab === 'roles' ? { background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)' } : { border: '1px solid transparent' }}
        >
          <Shield className="w-3.5 h-3.5" />
          Gestión de Roles
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
                    const s = ROLE_STYLES[user.role] ?? ROLE_STYLES.ADMIN;
                    const isSelf = user.id === currentUserId;
                    const displayRole = user.roleRef?.name ?? user.role;
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
                            {displayRole}
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
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingUser(user)}
                              title="Editar usuario"
                              className="p-1.5 rounded-lg text-[var(--pm-text-dim)] hover:text-[var(--pm-accent-gold)] hover:bg-[var(--pm-accent-gold)]/10 transition-all active:scale-90 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(user)}
                              disabled={isSelf}
                              title={isSelf ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
                              className="p-1.5 rounded-lg text-[var(--pm-text-dim)] hover:text-[var(--pm-accent-red)] hover:bg-[var(--pm-accent-red)]/10 transition-all active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      {tab === 'roles' && (
        <RolesManager
          roles={roles}
          isLoading={rolesLoading}
          isError={rolesError}
          error={rolesErr}
          onEdit={(role) => {
            setEditingRole(role);
            setShowRoleModal(true);
          }}
          onDelete={setDeleteRoleTarget}
        />
      )}

      {tab === 'database' && <DangerZone />}

      {/* ═══ NEW USER MODAL ═══ */}
      <UserFormModal
        isOpen={showModal}
        isPending={createUser.isPending}
        onSubmit={handleCreate}
        onClose={() => setShowModal(false)}
      />

      {/* ═══ EDIT USER MODAL ═══ */}
      <EditUserModal
        isOpen={!!editingUser}
        isPending={updateUser.isPending}
        user={editingUser}
        isSelf={!!editingUser && editingUser.id === currentUserId}
        onSubmit={handleUpdateUser}
        onClose={() => setEditingUser(null)}
      />

      {/* ═══ ROLE MODAL ═══ */}
      <RoleModal
        isOpen={showRoleModal}
        isPending={createRole.isPending || updateRole.isPending}
        role={editingRole}
        onSubmit={handleSaveRole}
        onClose={() => {
          setShowRoleModal(false);
          setEditingRole(null);
        }}
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
            El usuario <b>{deleteTarget?.username}</b> ({deleteTarget?.roleRef?.name ?? (deleteTarget ? roleLabel(deleteTarget.role) : '')}) se eliminará de forma permanente. Esta acción no se puede deshacer.
          </p>
        </div>
      </ConfirmDialog>

      {/* ═══ DELETE ROLE CONFIRM ═══ */}
      <ConfirmDialog
        isOpen={!!deleteRoleTarget}
        onClose={() => setDeleteRoleTarget(null)}
        onConfirm={handleDeleteRole}
        icon={<Trash2 className="w-4 h-4 text-[var(--pm-accent-red)]" />}
        title="Eliminar Rol"
        description={deleteRoleTarget?.name}
        confirmLabel="Eliminar"
        confirmIcon={<Trash2 className="w-3.5 h-3.5" />}
        variant="danger"
        loading={deleteRole.isPending}
      >
        <div className="p-3 rounded-lg border" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <p className="text-[11px] font-mono text-[var(--pm-accent-red)] leading-relaxed">
            El rol <b>{deleteRoleTarget?.name}</b> se eliminará de forma permanente. Esta acción no se puede deshacer.
          </p>
        </div>
      </ConfirmDialog>
    </motion.div>
  );
}