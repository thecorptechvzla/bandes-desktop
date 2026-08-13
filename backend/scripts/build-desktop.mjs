/*
 * Build Desktop (sidecar pkg):
 *   1) Compila dist/ con nest build (tsc emite decorator metadata).
 *   2) empaqueta el bundle CJS con esbuild inyectando DATABASE_URL y JWT_SECRET.
 *   3) genera backend-api.exe con @yao-pkg/pkg para Windows x64.
 *   4) lo renombra al target triple de Tauri:
 *        frontend/src-tauri/binaries/backend-api-x86_64-pc-windows-msvc.exe
 *
 * Uso (desde backend/): pnpm desktop:build
 */
import { readFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { build } from 'esbuild';
import { config } from 'dotenv';

const ROOT = resolve('..'); // bandes-desktop/
const BUNDLE_DIR = resolve('dist/desktop');
const TAURI_BIN_DIR = resolve(ROOT, 'frontend/src-tauri/binaries');

// ── 0) Leer backend/.env SOLO en tiempo de compilación (nunca se distribuye).
//        Las variables ya presentes en el entorno (ej: secrets de CI) tienen prioridad.
const env = { ...(config({ path: '.env' }).parsed || {}), ...process.env };

const DATABASE_URL = env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('[desktop] DATABASE_URL requerida en backend/.env para inyección en el binario');
}
const JWT_SECRET = env.JWT_SECRET || randomBytes(32).toString('hex');

// ── 1) Bundle con esbuild ──
if (!existsSync(resolve('dist/src/main.js'))) {
  throw new Error('[desktop] Ejecuta primero "nest build" (prisma generate && nest build)');
}

const nestOptionalStub = {
  name: 'nest-optional-stub',
  setup(build) {
    // NestJS requiere estos paquetes de forma opcional (optionalRequire/loadPackage)
    // con try/catch. En una app HTTP pura nunca se usan; los stubbeamos para
    // permitir bundle y ejecución mono-binario sin dependencias de transporte.
    const filter = /^@nestjs\/(microservices|websockets)(\/.*)?$/;
    build.onResolve({ filter }, () => ({
      path: 'nest-optional-stub',
      namespace: 'stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'module.exports = {};',
    }));
  },
};

await build({
  entryPoints: [resolve('dist/src/main.js')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs', // @yao-pkg/pkg espera CJS
  outfile: resolve(BUNDLE_DIR, 'backend-api.cjs'),
  plugins: [nestOptionalStub],
  define: {
    'process.env.DATABASE_URL': JSON.stringify(DATABASE_URL),
    'process.env.JWT_SECRET': JSON.stringify(JWT_SECRET),
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.PORT': JSON.stringify('3001'),
    'process.env.IS_DESKTOP': JSON.stringify('true'),
  },
  // Addons nativos y recursos de datos: los empaqueta pkg a través de node_modules
  external: ['@serialport/bindings-cpp', 'node-gyp-build', 'pdfkit'],
  logLevel: 'info',
});
console.log('[desktop] Bundle CJS generado');

// ── 2) pkg → .exe Windows ──
mkdirSync(BUNDLE_DIR, { recursive: true });
const pkgBin = resolve('node_modules/.bin/pkg');
if (!existsSync(pkgBin)) {
  throw new Error('[desktop] Faltan dependencias: pnpm add -D @yao-pkg/pkg');
}
execFileSync(
  pkgBin,
  [
    resolve(BUNDLE_DIR, 'backend-api.cjs'),
    '--target', 'node22-win-x64',
    '--output', resolve(BUNDLE_DIR, 'backend-api.exe'),
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

// ── 3) Renombrar al target triple de Tauri y copiar a frontend/src-tauri ──
mkdirSync(TAURI_BIN_DIR, { recursive: true });
const targetName = 'backend-api-x86_64-pc-windows-msvc.exe';
const dst = resolve(TAURI_BIN_DIR, targetName);
renameSync(resolve(BUNDLE_DIR, 'backend-api.exe'), dst);
console.log(`[desktop] Sidecar listo para Tauri: ${dst}`);