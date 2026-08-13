'use client';

import React, { useEffect, useState } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Download, X, Loader2, TriangleAlert } from 'lucide-react';

export default function UpdaterBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const isTauri =
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauri) return;

    let cancelled = false;
    (async () => {
      try {
        const upd = await check();
        if (!cancelled && upd) setUpdate(upd);
      } catch {
        // Sin endpoint de updates (dev) o red LAN sin servidor: silencioso.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update || dismissed) return null;

  const handleUpdate = async () => {
    setInstalling(true);
    setError('');
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch {
      setError('No se pudo completar la actualización. Verifique la red e intente de nuevo.');
      setInstalling(false);
    }
  };

  return (
    <div className="fixed bottom-16 right-4 z-[70] w-[320px] glass-panel p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--hud-accent-gold)]/15 text-[var(--hud-accent-gold)]">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--hud-text-primary)]">
            Actualización disponible
          </p>
          <p className="mt-0.5 text-xs text-[var(--hud-text-dim)]">
            Nueva versión v{update.version}. ¿Descargar e instalar ahora?
          </p>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--hud-accent-red)]">
              <TriangleAlert className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleUpdate}
              disabled={installing}
              className="flex items-center gap-1.5 rounded-lg border border-[rgba(251,191,36,0.35)] bg-gradient-to-r from-[#D5B042] to-[#FBBF24] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#0F111A] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {installing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Instalando…
                </>
              ) : (
                'Actualizar'
              )}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-lg border border-[var(--hud-border)] px-3 py-1.5 text-xs font-medium text-[var(--hud-text-dim)] transition-colors hover:text-[var(--hud-text-primary)]"
            >
              Ahora no
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso de actualización"
          className="shrink-0 rounded-md p-1 text-[var(--hud-text-muted)] transition-colors hover:text-[var(--hud-text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}