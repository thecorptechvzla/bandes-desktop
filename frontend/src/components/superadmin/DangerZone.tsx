'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Users as UsersIcon, FolderUp, Flame, ArrowLeftRight,
  Trash2, AlertTriangle, Loader2,
} from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { usePackings } from '@/hooks/usePackings';
import { useProcesses } from '@/hooks/useProcesses';
import { useMaterialExits } from '@/hooks/useExits';
import {
  useHardDeleteClient,
  useHardDeletePacking,
  useHardDeleteProcess,
  useHardDeleteMaterialExit,
} from '@/hooks/useSuperadmin';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatRif } from '@/lib/format';
import type { Client, Packing, Process, MaterialExit } from '@/types/api';

type ModuleTab = 'clients' | 'packings' | 'processes' | 'exits';

type DeleteTarget =
  | { type: 'client'; id: string; label: string }
  | { type: 'packing'; id: string; label: string }
  | { type: 'process'; id: string; label: string }
  | { type: 'exit'; id: string; label: string };

const MODULES: { id: ModuleTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'clients', label: 'Proveedores', icon: UsersIcon },
  { id: 'packings', label: 'Packings', icon: FolderUp },
  { id: 'processes', label: 'Procesos', icon: Flame },
  { id: 'exits', label: 'Egresos', icon: ArrowLeftRight },
];

const TH = 'text-[10px] text-[var(--pm-text-dim)] font-mono font-bold uppercase tracking-widest';

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PROCESS_STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  OPEN: { color: 'var(--pm-accent-emerald)', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
  CLOSED: { color: 'var(--pm-accent-cyan)', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)' },
  CANCELLED: { color: 'var(--pm-accent-red)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
};

interface Column<T> {
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DangerTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  emptyLabel: string;
  getId: (row: T) => string;
  deletingId: string | null;
  onDelete: (row: T) => void;
}

function DangerTable<T>({
  rows, columns, isLoading, isError, error, emptyLabel, getId, deletingId, onDelete,
}: DangerTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--pm-accent-emerald)]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--pm-accent-red)]">
        <AlertTriangle className="w-8 h-8 mb-3" />
        <span className="text-sm font-sans">Error al cargar los registros</span>
        <span className="text-xs text-[var(--pm-text-dim)] mt-1">
          {(error as any)?.message || 'Error de conexión'}
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--pm-text-dim)]">
        <FolderUp className="w-10 h-10 text-[var(--pm-accent-gold)]/20 mb-3 animate-pulse" />
        <span className="text-sm font-sans">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse font-sans text-xs">
        <thead>
          <tr className="border-b border-[var(--pm-border)]">
            {columns.map((col) => (
              <th key={col.header} className={`py-3 px-4 ${TH} ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
            <th className={`py-3 pr-6 text-right ${TH}`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getId(row);
            const isDeleting = deletingId === id;
            return (
              <tr key={id} className="border-b border-[var(--pm-border)]/50 hover:bg-[var(--pm-bg-tertiary)]/40 transition-colors">
                {columns.map((col) => (
                  <td key={col.header} className={`py-3 px-4 ${col.className || ''}`}>
                    {col.render(row)}
                  </td>
                ))}
                <td className="py-3 pr-6 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    disabled={!!deletingId}
                    title="Eliminar registro (Zona de Peligro)"
                    className="p-1.5 rounded-lg text-[var(--pm-text-dim)] hover:text-[var(--pm-accent-red)] hover:bg-[var(--pm-accent-red)]/10 transition-all active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isDeleting
                      ? <Loader2 className="w-4 h-4 animate-spin text-[var(--pm-accent-red)]" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DangerZone() {
  const [activeModule, setActiveModule] = useState<ModuleTab>('clients');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data: clients = [], isLoading: clientsLoading, isError: clientsError, error: clientsErr } = useClients();
  const { data: packings = [], isLoading: packingsLoading, isError: packingsError, error: packingsErr } = usePackings();
  const { data: processes = [], isLoading: processesLoading, isError: processesError, error: processesErr } = useProcesses();
  const { data: exits = [], isLoading: exitsLoading, isError: exitsError, error: exitsErr } = useMaterialExits();

  const hardDeleteClient = useHardDeleteClient();
  const hardDeletePacking = useHardDeletePacking();
  const hardDeleteProcess = useHardDeleteProcess();
  const hardDeleteExit = useHardDeleteMaterialExit();

  const deleting =
    hardDeleteClient.isPending ||
    hardDeletePacking.isPending ||
    hardDeleteProcess.isPending ||
    hardDeleteExit.isPending;

  const deletingId = deleting ? deleteTarget?.id ?? null : null;

  const sortedClients = [...clients].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const sortedProcesses = [...processes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const clientColumns: Column<Client>[] = [
    { header: 'ID', className: 'pl-6 w-[14%]', render: (c) => <span className="font-mono text-[var(--pm-text-dim)]">{shortId(c.id)}</span> },
    { header: 'Nombre / Razón Social', className: 'w-[36%]', render: (c) => <span className="font-mono font-bold text-[var(--pm-text-primary)]">{c.name}</span> },
    { header: 'RIF', className: 'w-[20%]', render: (c) => <span className="font-mono text-[var(--pm-accent-gold)]">{formatRif(c.rif)}</span> },
    { header: 'Creado el', className: 'w-[20%]', render: (c) => <span className="font-mono text-[var(--pm-text-dim)]">{formatDate(c.createdAt)}</span> },
  ];

  const packingColumns: Column<Packing>[] = [
    { header: 'ID / Número', className: 'pl-6 w-[20%]', render: (p) => (
      <span className="font-mono text-[var(--pm-text-primary)]">
        {p.packingNumber ? `P-${p.packingNumber}` : shortId(p.id)}
      </span>
    ) },
    { header: 'Proveedor', className: 'w-[34%]', render: (p) => <span className="font-mono text-[var(--pm-text-primary)]">{p.client?.name || '—'}</span> },
    { header: 'Cant. Barras', className: 'w-[16%] text-center', render: (p) => <span className="font-mono font-bold text-[var(--pm-text-primary)]">{p._count?.bars ?? 0}</span> },
    { header: 'Fecha', className: 'w-[20%]', render: (p) => <span className="font-mono text-[var(--pm-text-dim)]">{formatDate(p.createdAt)}</span> },
  ];

  const processColumns: Column<Process>[] = [
    { header: 'ID (Proceso)', className: 'pl-6 w-[30%]', render: (p) => (
      <div>
        <div className="font-mono font-bold text-[var(--pm-text-primary)]">{p.name}</div>
        <div className="font-mono text-[9px] text-[var(--pm-text-dim)]">{shortId(p.id)}</div>
      </div>
    ) },
    { header: 'Operador', className: 'w-[20%]', render: (p) => (
      <span className="font-mono text-[var(--pm-text-dim)]">{p.lots?.find((l) => l.operator)?.operator || '—'}</span>
    ) },
    { header: 'Estado', className: 'w-[16%] text-center', render: (p) => {
      const s = PROCESS_STATUS_STYLE[p.status] || PROCESS_STATUS_STYLE.OPEN;
      return (
        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border" style={{ color: s.color, background: s.bg, borderColor: s.border }}>
          {p.status}
        </span>
      );
    } },
    { header: 'Fecha', className: 'w-[20%]', render: (p) => <span className="font-mono text-[var(--pm-text-dim)]">{formatDate(p.createdAt)}</span> },
  ];

  const exitColumns: Column<MaterialExit>[] = [
    { header: 'ID (Despacho)', className: 'pl-6 w-[16%]', render: (e) => <span className="font-mono text-[var(--pm-text-dim)]">{shortId(e.id)}</span> },
    { header: 'Destino', className: 'w-[30%]', render: (e) => <span className="font-mono font-bold text-[var(--pm-text-primary)]">{e.destination}</span> },
    { header: 'Lotes / Barras', className: 'w-[22%] text-center', render: (e) => (
      <span className="font-mono text-[var(--pm-text-dim)]">
        {e.bars.length} barras · {e.exitDetails.length} lotes
      </span>
    ) },
    { header: 'Fecha', className: 'w-[20%]', render: (e) => <span className="font-mono text-[var(--pm-text-dim)]">{formatDate(e.createdAt)}</span> },
  ];

  const handleDelete = (target: DeleteTarget) => setDeleteTarget(target);

  const handleConfirm = async () => {
    if (!deleteTarget) return;
    switch (deleteTarget.type) {
      case 'client':
        await hardDeleteClient.mutateAsync(deleteTarget.id);
        break;
      case 'packing':
        await hardDeletePacking.mutateAsync(deleteTarget.id);
        break;
      case 'process':
        await hardDeleteProcess.mutateAsync(deleteTarget.id);
        break;
      case 'exit':
        await hardDeleteExit.mutateAsync(deleteTarget.id);
        break;
    }
    setDeleteTarget(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="glass-panel overflow-hidden"
    >
      {/* ═══ SUB-TABS (módulos) ═══ */}
      <div className="flex gap-1 p-2 border-b border-[var(--pm-border)] bg-[var(--pm-bg-deepest)]/60 overflow-x-auto">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const active = activeModule === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveModule(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                active ? 'text-[var(--pm-accent-red)]' : 'text-[var(--pm-text-dim)] hover:text-[var(--pm-text-primary)]'
              }`}
              style={active ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' } : { border: '1px solid transparent' }}
            >
              <Icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TABLE POR MÓDULO ═══ */}
      <div className="p-2">
        {activeModule === 'clients' && (
          <DangerTable
            rows={sortedClients}
            columns={clientColumns}
            isLoading={clientsLoading}
            isError={clientsError}
            error={clientsErr}
            emptyLabel="No hay proveedores registrados"
            getId={(c) => c.id}
            deletingId={deletingId}
            onDelete={(c) => handleDelete({ type: 'client', id: c.id, label: c.name })}
          />
        )}

        {activeModule === 'packings' && (
          <DangerTable
            rows={packings}
            columns={packingColumns}
            isLoading={packingsLoading}
            isError={packingsError}
            error={packingsErr}
            emptyLabel="No hay packings registrados"
            getId={(p) => p.id}
            deletingId={deletingId}
            onDelete={(p) => handleDelete({ type: 'packing', id: p.id, label: p.packingNumber ? `Packing P-${p.packingNumber}` : `Packing ${shortId(p.id)}` })}
          />
        )}

        {activeModule === 'processes' && (
          <DangerTable
            rows={sortedProcesses}
            columns={processColumns}
            isLoading={processesLoading}
            isError={processesError}
            error={processesErr}
            emptyLabel="No hay procesos registrados"
            getId={(p) => p.id}
            deletingId={deletingId}
            onDelete={(p) => handleDelete({ type: 'process', id: p.id, label: p.name })}
          />
        )}

        {activeModule === 'exits' && (
          <DangerTable
            rows={exits}
            columns={exitColumns}
            isLoading={exitsLoading}
            isError={exitsError}
            error={exitsErr}
            emptyLabel="No hay egresos registrados"
            getId={(e) => e.id}
            deletingId={deletingId}
            onDelete={(e) => handleDelete({ type: 'exit', id: e.id, label: e.destination })}
          />
        )}
      </div>

      {/* ═══ ALERTA DE PELIGRO ═══ */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirm}
        icon={<AlertTriangle className="w-4 h-4 text-[var(--pm-accent-red)]" />}
        title="¡CUIDADO! Zona de Peligro"
        description={deleteTarget?.label}
        confirmLabel="Eliminar"
        confirmIcon={<Trash2 className="w-3.5 h-3.5" />}
        variant="danger"
        loading={deleting}
      >
        <div className="p-3 rounded-lg border" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <p className="text-[11px] font-mono text-[var(--pm-accent-red)] leading-relaxed">
            ¡CUIDADO! Estás en la Zona de Peligro. Eliminar este registro borrará en cascada todos los datos asociados. Esta acción es irreversible. ¿Deseas continuar?
          </p>
        </div>
      </ConfirmDialog>
    </motion.div>
  );
}