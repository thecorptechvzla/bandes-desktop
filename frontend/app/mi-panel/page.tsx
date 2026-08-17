'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Flame, Layers, Gem, ClipboardCheck, History, Loader2,
  AlertTriangle, CalendarDays, Clock, CircleDollarSign,
} from 'lucide-react';
import { useOperatorMetrics } from '@/hooks/useOperatorMetrics';
import { getSession } from '@/lib/auth';
import { formatWeight, formatNumber } from '@/lib/format';
import type { OperatorActivityItem } from '@/types/api';

const CARD_ACCENTS = [
  { glow: '#FBBF24', iconBg: 'rgba(251,191,36,0.12)', iconColor: '#FBBF24' },
  { glow: '#22D3EE', iconBg: 'rgba(34,211,238,0.12)', iconColor: '#22D3EE' },
  { glow: '#10B981', iconBg: 'rgba(16,185,129,0.12)', iconColor: '#10B981' },
  { glow: '#A78BFA', iconBg: 'rgba(167,139,250,0.12)', iconColor: '#A78BFA' },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'EN PROCESO', cls: 'text-[var(--hud-accent-gold)] border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.08)]' },
  CLOSED: { label: 'CERRADO', cls: 'text-[var(--hud-accent-emerald)] border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)]' },
  CANCELLED: { label: 'CANCELADO', cls: 'text-[var(--hud-accent-red)] border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)]' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function MiPanelPage() {
  const { data, isLoading, isError } = useOperatorMetrics();
  const [username, setUsername] = useState('');
  const [today, setToday] = useState('');

  useEffect(() => {
    setUsername(getSession()?.username ?? '');
    setToday(
      new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    );
  }, []);

  const kpis = data?.kpis;
  const activity = data?.actividadReciente ?? [];

  const cards = [
    {
      label: 'Procesos Atendidos',
      value: kpis ? formatNumber(kpis.procesosAtendidos, 0) : '—',
      sub: kpis ? `${formatNumber(kpis.lotesOperados, 0)} lote(s) operado(s)` : '—',
      icon: Flame,
    },
    {
      label: 'Barras en tus Procesos',
      value: kpis ? formatNumber(kpis.barrasEnProcesos, 0) : '—',
      sub: 'Barras asignadas a tus lotes',
      icon: Layers,
    },
    {
      label: 'Recuperado por ti',
      value: kpis ? formatWeight(kpis.recuperadoGramos, 2) : '—',
      sub: 'Oro fino recuperado en fundición',
      icon: Gem,
    },
    {
      label: 'Pendientes por Validar',
      value: kpis ? formatNumber(kpis.pendientesPorValidar, 0) : '—',
      sub: 'Trabajo disponible en el sistema',
      icon: ClipboardCheck,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* ─── SALUDO PERSONALIZADO ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-[0.18em] text-[var(--hud-text-primary)]">
            Hola, {username || 'operador'}
          </h1>
          <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--hud-text-dim)]">
            Panel personal de control
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--hud-bg-card)] rounded-xl border border-[var(--hud-border)]">
          <CalendarDays className="w-3.5 h-3.5 text-[var(--hud-accent-emerald)]" />
          <span className="text-[11px] font-mono text-[var(--hud-text-dim)] capitalize">{today}</span>
        </div>
      </motion.div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="kpi-card rounded-xl border border-[var(--hud-border)] bg-[var(--hud-bg-card)] p-4 hover:-translate-y-1 active:scale-95 transition-all duration-300 ease-out"
              style={{ ['--kpi-glow' as string]: accent.glow }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: accent.iconBg }}
                >
                  <Icon className="h-5 w-5" style={{ color: accent.iconColor }} />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--hud-text-dim)]">
                  {card.label}
                </span>
              </div>
              <div className="mt-3 text-2xl font-mono font-bold text-[var(--hud-text-primary)]">
                {card.value}
              </div>
              <div className="mt-1 text-[10px] font-mono text-[var(--hud-text-muted)]">{card.sub}</div>
            </motion.div>
          );
        })}
      </div>

      {/* ─── ACTIVIDAD RECIENTE ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="hud-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--hud-accent-emerald)]" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-[0.14em] text-[var(--hud-text-primary)]">
              Actividad Reciente
            </h2>
          </div>
          {!isLoading && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--hud-text-muted)]">
              {activity.length} registro(s)
            </span>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-14">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--hud-accent-emerald)]" />
            <span className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--hud-text-dim)]">
              Cargando panel…
            </span>
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex items-center justify-center gap-3 py-14">
            <AlertTriangle className="h-5 w-5 text-[var(--hud-accent-red)]" />
            <span className="text-xs font-mono text-[var(--hud-text-dim)]">
              No se pudo cargar tus métricas. Verifique la conexión con el sistema.
            </span>
          </div>
        )}

        {!isLoading && !isError && activity.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-[var(--hud-text-dim)]">
            <ClipboardCheck className="h-6 w-6 opacity-60" />
            <span className="text-xs font-mono">Aún no tienes procesos registrados.</span>
            <span className="text-[10px] font-mono text-[var(--hud-text-muted)]">
              Cuando operes una fundición, tus lotes aparecerán aquí.
            </span>
          </div>
        )}

        {!isLoading && !isError && activity.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--hud-border)]">
                  {['Lote', 'Proceso / Proveedor', 'Estado', 'Barras', 'Recuperado', 'Fecha'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[9px] font-mono uppercase tracking-[0.16em] text-[var(--hud-text-muted)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map((row: OperatorActivityItem) => {
                  const meta = STATUS_META[row.processStatus] ?? STATUS_META.OPEN;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--hud-border)]/50 last:border-0 hover:bg-[var(--hud-bg-elevated)]/40 transition-colors"
                    >
                      <td className="px-3 py-3 font-mono text-xs text-[var(--hud-text-primary)]">
                        {row.name}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs text-[var(--hud-text-primary)]">{row.processName}</div>
                        <div className="text-[10px] font-mono text-[var(--hud-text-muted)]">{row.clientName}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[9px] font-mono uppercase tracking-wider ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-[var(--hud-text-dim)]">
                        {formatNumber(row.barCount, 0)}
                      </td>
                      <td className="px-3 py-3">
                        {row.recovered !== null ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-[var(--hud-accent-emerald)]">
                            <CircleDollarSign className="w-3 h-3" />
                            {formatWeight(row.recovered, 2)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-[var(--hud-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--hud-text-dim)]">
                          <Clock className="w-3 h-3 opacity-70" />
                          {formatDate(row.date)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}