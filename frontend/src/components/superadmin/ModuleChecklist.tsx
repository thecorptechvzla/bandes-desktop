'use client';

import React from 'react';
import { CheckSquare, Square, Lock } from 'lucide-react';
import type { ModuleId } from '@/types/api';
import { MODULES } from '@/lib/modules';

interface ModuleChecklistProps {
  selected: ModuleId[];
  onToggle: (id: ModuleId) => void;
  disabled?: boolean;
  locked?: boolean;
  hideSuperadmin?: boolean;
  accent?: 'gold' | 'emerald' | 'cyan';
  label?: string;
  hint?: string | null;
}

const ACCENTS = {
  gold: {
    text: 'var(--pm-accent-gold)',
    border: 'rgba(212,175,55,0.35)',
    bg: 'rgba(212,175,55,0.08)',
  },
  emerald: {
    text: 'var(--pm-accent-emerald)',
    border: 'rgba(16,185,129,0.35)',
    bg: 'rgba(16,185,129,0.08)',
  },
  cyan: {
    text: 'var(--pm-accent-cyan)',
    border: 'rgba(56,189,248,0.35)',
    bg: 'rgba(56,189,248,0.08)',
  },
};

export function ModuleChecklist({
  selected,
  onToggle,
  disabled = false,
  locked = false,
  hideSuperadmin = false,
  accent = 'gold',
  label = 'Módulos del Sidebar',
  hint = null,
}: ModuleChecklistProps) {
  const color = ACCENTS[accent];
  const list = hideSuperadmin ? MODULES.filter((m) => m.id !== 'superadmin') : MODULES;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-mono text-[var(--pm-text-dim)] uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[10px] font-mono text-[var(--pm-text-dim)]">
          {selected.length}/{list.length} seleccionados
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {list.map((m) => {
          const checked = selected.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggle(m.id)}
              disabled={disabled}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[11px] font-mono transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed ${
                checked ? '' : 'text-[var(--pm-text-dim)]'
              }`}
              style={{
                color: checked ? color.text : undefined,
                borderColor: checked ? color.border : 'var(--pm-border)',
                background: checked ? color.bg : 'transparent',
                opacity: disabled ? 0.75 : 1,
              }}
            >
              {checked ? (
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Square className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{m.label}</span>
              {locked && <Lock className="w-3 h-3 shrink-0 ml-auto opacity-60" />}
            </button>
          );
        })}
      </div>
      {hint && (
        <p className="text-[10px] font-mono flex items-center gap-1" style={{ color: color.text }}>
          <Lock className="w-3 h-3 shrink-0" /> {hint}
        </p>
      )}
    </div>
  );
}