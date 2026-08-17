'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Check, AlertCircle, X,
} from 'lucide-react';
import type { ModuleId, Role, CreateRoleRequest, UpdateRoleRequest } from '@/types/api';
import { MODULES } from '@/lib/modules';
import { ModuleChecklist } from './ModuleChecklist';

interface RoleModalProps {
  isOpen: boolean;
  isPending: boolean;
  role: Role | null; // null => crear
  onSubmit: (data: CreateRoleRequest | UpdateRoleRequest) => Promise<void>;
  onClose: () => void;
}

export function RoleModal({ isOpen, isPending, role, onSubmit, onClose }: RoleModalProps) {
  const isSystem = !!role?.isSystem;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<ModuleId[]>(MODULES.map((m) => m.id));
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && nameRef.current) nameRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setName(role?.name ?? '');
      setDescription(role?.description ?? '');
      setSelected(role ? [...role.allowedModules] : MODULES.map((m) => m.id));
      setFormError('');
      setFormSuccess('');
    }
  }, [isOpen, role]);

  const toggleModule = (id: ModuleId) => {
    if (isSystem) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const clean = name.trim().toUpperCase();
    if (clean.length < 3) {
      setFormError('El nombre del rol debe tener al menos 3 caracteres.');
      return;
    }
    if (selected.length === 0) {
      setFormError('Debe seleccionar al menos un módulo.');
      return;
    }

    setSaving(true);
    try {
      if (role) {
        await onSubmit({ name: clean, description: description.trim(), allowedModules: selected });
      } else {
        await onSubmit({ name: clean, description: description.trim(), allowedModules: selected });
      }
      setFormSuccess(role ? 'Rol actualizado correctamente.' : 'Rol creado correctamente.');
      setSaving(false);
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Error al guardar el rol.');
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="role-modal"
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
            className="w-full max-w-lg glass-panel rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ═══ HEADER ═══ */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--pm-border)]">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}
                >
                  <Shield className="w-4 h-4 text-[var(--pm-accent-gold)]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-[var(--pm-accent-gold)] uppercase tracking-wider">
                    Gestión de Roles
                  </span>
                  <h3 className="text-sm font-sans font-semibold text-[var(--pm-text-primary)] mt-0.5">
                    {role ? `Editar Rol · ${role.name}` : 'Nuevo Rol'}
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
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--pm-text-dim)] uppercase tracking-wider">
                  Nombre del Rol
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  placeholder="p.ej. ALMACENISTA"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSystem}
                  className="pm-input font-mono uppercase"
                  required
                />
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--pm-text-dim)] uppercase tracking-wider">
                  Descripción
                </label>
                <input
                  type="text"
                  placeholder="¿Qué hace este rol?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="pm-input font-mono"
                />
              </div>

              {/* Módulos */}
              <ModuleChecklist
                selected={selected}
                onToggle={toggleModule}
                disabled={isSystem}
                locked={isSystem}
                accent="gold"
                label="Módulos del Sidebar"
                hint={
                  isSystem
                    ? 'Rol del sistema: no se puede renombrar ni desmarcar sus módulos.'
                    : null
                }
              />

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
                  {saving || isPending ? 'Guardando...' : role ? 'Guardar Cambios' : 'Crear Rol'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}