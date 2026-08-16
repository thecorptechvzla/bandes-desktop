'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserPlus, KeyRound, Tag, Check, AlertCircle, X,
} from 'lucide-react';
import type { CreateUserRequest, UserRole } from '@/types/api';

const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: 'Superadmin',
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
};

const ROLE_STYLES: Record<UserRole, { color: string; bg: string; border: string }> = {
  SUPERADMIN: { color: 'var(--pm-accent-gold)', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.35)' },
  OWNER: { color: 'var(--pm-accent-cyan)', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)' },
  ADMIN: { color: 'var(--pm-accent-emerald)', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
};

interface UserFormModalProps {
  isOpen: boolean;
  isPending: boolean;
  onSubmit: (data: CreateUserRequest) => Promise<void>;
  onClose: () => void;
}

export function UserFormModal({ isOpen, isPending, onSubmit, onClose }: UserFormModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && usernameRef.current) usernameRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setRole('ADMIN');
      setFormError('');
      setFormSuccess('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (username.trim().length < 3) {
      setFormError('El username debe tener al menos 3 caracteres.');
      return;
    }
    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({ username: username.trim(), password, role });
      setFormSuccess('Usuario creado correctamente.');
      setSaving(false);
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Error al crear el usuario.');
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="user-form-modal"
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
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <UserPlus className="w-4 h-4 text-[var(--pm-accent-gold)]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-[var(--pm-accent-gold)] uppercase tracking-wider">
                    Gestión de Usuarios
                  </span>
                  <h3 className="text-sm font-sans font-semibold text-[var(--pm-text-primary)] mt-0.5">
                    Nuevo Usuario
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

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--pm-text-dim)] uppercase tracking-wider flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Contraseña
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pm-input font-mono"
                  required
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--pm-text-dim)] uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Rol
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SUPERADMIN', 'OWNER', 'ADMIN'] as const).map(r => {
                    const s = ROLE_STYLES[r];
                    const active = role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className="py-2.5 rounded-lg border text-[11px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                        style={
                          active
                            ? { color: s.color, background: s.bg, borderColor: s.border }
                            : { color: 'var(--pm-text-dim)', borderColor: 'var(--pm-border)' }
                        }
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    );
                  })}
                </div>
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
                    background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.1))',
                    color: 'var(--pm-accent-gold)',
                    border: '1px solid rgba(212,175,55,0.3)',
                  }}
                >
                  {saving || isPending ? 'Guardando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}