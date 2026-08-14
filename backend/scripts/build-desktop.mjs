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
import { readFileSync, existsSync, mkdirSync, renameSync, copyFileSync } from 'node:fs';
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

const nodeGypBuildShimPlugin = {
  name: 'node-gyp-build-shim',
  setup(build) {
    // node-gyp-build (CJS) se reemplaza por nuestro shim que hace process.dlopen
    // sobre dist/desktop/serialport.node (ruta determinista embebida por pkg).
    build.onResolve({ filter: /^node-gyp-build$/ }, () => ({
      path: resolve('scripts/node-gyp-build-shim.cjs'),
      namespace: 'file',
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
  plugins: [nestOptionalStub, nodeGypBuildShimPlugin],
  define: {
    'process.env.DATABASE_URL': JSON.stringify(DATABASE_URL),
    'process.env.JWT_SECRET': JSON.stringify(JWT_SECRET),
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.PORT': JSON.stringify('3001'),
    'process.env.IS_DESKTOP': JSON.stringify('true'),
  },
  // bindings-cpp y node-gyp-build van DENTRO del bundle (el shim los maneja);
  // pdfkit se mantiene external (sus assets .afm se empaquetan por separado).
  external: ['pdfkit'],
  logLevel: 'info',
});
console.log('[desktop] Bundle CJS generado');

// ── 1.5) Copiar el prebuild nativo de serialport (win32-x64) junto al bundle ──
// pkg no incrusta de forma confiable los assets dentro de node_modules (pnpm),
// así que el .node se copia explícitamente a dist/desktop/serialport.node y se
// declara en pkg.assets; el shim lo carga con process.dlopen.
const serialportNodeSrc = resolve(
  'node_modules/@serialport/bindings-cpp/prebuilds/win32-x64/@serialport+bindings-cpp.node',
);
if (!existsSync(serialportNodeSrc)) {
  throw new Error('[desktop] No se encontró el prebuild win32-x64 de serialport');
}
copyFileSync(serialportNodeSrc, resolve(BUNDLE_DIR, 'serialport.node'));
console.log('[desktop] serialport.node copiado junto al bundle');

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