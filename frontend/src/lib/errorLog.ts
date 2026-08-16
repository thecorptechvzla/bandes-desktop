import { invoke } from '@tauri-apps/api/core';

type LogLevel = 'ERROR' | 'WARN' | 'API' | 'BACKEND' | 'SIDECAR';

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let initialized = false;

export function writeError(level: LogLevel, message: string): void {
  if (!isTauri) {
    console.error(`[log:${level}]`, message);
    return;
  }
  invoke('log_error', { level, message }).catch(() => {
    // Si falla el registro, no bloquear la app.
  });
}

export function logApiError(
  method: string,
  url: string,
  status?: number,
  message?: string,
): void {
  writeError(
    'API',
    `${method} ${url} → ${status ?? '—'}${message ? ` — ${message}` : ''}`,
  );
}

export function openLogsFolder(): void {
  if (!isTauri) return;
  invoke('open_logs_folder').catch(() => {});
}

export function initErrorLog(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (e) => {
    const stack = e.error instanceof Error ? `\n${e.error.stack ?? ''}` : '';
    writeError(
      'ERROR',
      `${e.message} @ ${e.filename ?? 'unknown'}:${e.lineno ?? 0}${stack}`,
    );
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason =
      e.reason instanceof Error
        ? `${e.reason.message}\n${e.reason.stack ?? ''}`
        : String(e.reason);
    writeError('ERROR', `unhandledrejection: ${reason}`);
  });
}