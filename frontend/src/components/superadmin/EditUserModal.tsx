'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserCog, KeyRound, Tag, Power, Check, AlertCircle, X,
} from 'lucide-react';
import type { User, UpdateUserRequest } from '@/types/api';
import { useSuperadminRoles } from '@/hooks/useSuperadminRoles';

interface EditUserModalProps {
  isOpen: boolean;
  isPending: boolean;
  user: User | null;
  isSelf: boolean;
  onSubmit: (id: string, data: UpdateUserRequest) => Promise<void>;
  onClose: () => void;
}

export function EditUserModal({ isOpen, isPending, user, isSelf, onSubmit, onClose }: EditUserModalProps) {
  const { data: roles = [], isLoading: rolesLoading } = useSuperadminRoles();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && usernameRef.current) usernameRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && user) {
      setUsername(user.username);
      setRoleId(
        user.roleId ||
        user.roleRef?.id ||
        roles.find((r) => r.name === user.role)?.id ||
        roles.find((r) => !r.isSystem)?.id ||
        '',
      );
      setActive(user.active);
      setPassword('');
      setFormError('');
      setFormSuccess('');
    }
  }, [isOpen, user, roles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');
    setFormSuccess('');

    if (username.trim().length < 3) {
      setFormError('El username debe tener al menos 3 caracteres.');
      return;
    }
    if (password && password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!roleId) {
      setFormError('Selecciona un rol para el usuario.');
      return;
    }

    const data: UpdateUserRequest = {
      username: username.trim(),
      roleId,
      active,
    };
    if (password) data.password = password;

    setSaving(true);
    try {
      await onSubmit(user.id, data);
      setFormSuccess('Cambios guardados correctamente.');
      setSaving(false);
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Error al actualizar el usuario.');
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && user && (
        <motion.div
          key="edit-user-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md glass-panel rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ═══ HEADER ═══ */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--pm-border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}>
                  <UserCog className="w-4 h-4 text-[var(--pm-accent-cyan)]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-[var(--pm-accent-cyan)] uppercase tracking-wider">
                    Gestión de Usuarios
                  </span>
                  <h3 className="text-sm font-sans font-semibold text-[var(--pm-text-primary)] mt-0.5">
                    Editar Usuario
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--pm-bg-tertiary)] text-[var(--pm-text-dim)] hover:text-[var(--pm-text-primary)] active:scale-90 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ═══ FORM BODY ═══ */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--pm-text-dim)] uppercase tracking-wider flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Username
                </label>
                <input
                  ref={usernameRef}
                  type="text"
                  placeholder="usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pm-input font-mono"
                  required
                />
              </div>

              {/* Password (opcional) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--pm-text-dim)] uppercase tracking-wider flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Nueva Contraseña
                </label>
                <input
                  type="password"
                  placeholder="Déjalo en blanco para mantener la actual"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pm-input font-mono"
                  autoComplete="new-password"
                />
                <p className="text-[10px] font-mono text-[var(--pm-text-dim)]">
                  Solo se actualiza si escribes una nueva contraseña (mínimo 6 caracteres).
                </p>
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--pm-text-dim)] uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Rol
                </label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  disabled={isSelf || rolesLoading}
                  className="pm-input font-mono appearance-none w-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {rolesLoading && <option value="">Cargando roles...</option>}
                  {!rolesLoading && roles.length === 0 && <option value="">Sin roles disponibles</option>}
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}{r.isSystem ? '  ⭐' : ''}
                    </option>
                  ))}
                </select>
                {isSelf && (
                  <p className="text-[10px] font-mono text-[var(--pm-accent-gold)]">
                    Estás editando tu propio usuario: el rol no se puede modificar.
                  </p>
                )}
              </div>

              {/* Active */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--pm-text-dim)] uppercase tracking-wider flex items-center gap-1">
                  <Power className="w-3 h-3" /> Estado
                </label>
                <button
                  type="button"
                  onClick={() => setActive(v => !v)}
                  className="flex items-center justify-between w-full py-2.5 px-4 rounded-lg border transition-all active:scale-95 cursor-pointer"
                  style={{ borderColor: 'var(--pm-border)' }}
                >
                  <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${active ? 'text-[var(--pm-accent-emerald)]' : 'text-[var(--pm-accent-red)]'}`}>
                    {active ? 'Activo' : 'Inactivo'}
                  </span>
                  <span
                    className="relative w-9 h-5 rounded-full transition-colors"
                    style={{ background: active ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                      style={{ left: active ? 'calc(100% - 18px)' : '2px' }}
                    />
                  </span>
                </button>
              </div>

              {/* Messages */}
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-[var(--pm-accent-red)]/10 border border-[var(--pm-accent-red)]/25 rounded-lg text-[var(--pm-accent-red)] text-xs font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="flex items-center gap-2 p-3 bg-[var(--pm-accent-emerald)]/10 border border-[var(--pm-accent-emerald)]/25 rounded-lg text-[var(--pm-accent-emerald)] text-xs font-mono">
                  <Check className="w-4 h-4 shrink-0" />
                  {formSuccess}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-[var(--pm-border)] text-[var(--pm-text-dim)] hover:text-[var(--pm-text-primary)] hover:bg-[var(--pm-bg-tertiary)] text-xs font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || saving}
                  className="flex-1 py-2.5 px-4 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.1))',
                    color: 'var(--pm-accent-cyan)',
                    border: '1px solid rgba(56,189,248,0.3)',
                  }}
                >
                  {saving || isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}