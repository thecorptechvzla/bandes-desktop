# CONTEXTO — Migración Bandes: Web → Desktop

> **Propósito:** dar a otro agente de IA (o desarrollador) el contexto completo de cómo la
> plataforma **web** Bandes se migró a una **aplicación de escritorio Windows** que opera
> 100% en red local (LAN). Documento de handoff: lee esto primero, luego el código.
>
> **Fecha:** agosto 2026 · **Versión actual de la app desktop:** `0.1.6`

---

## 1. Los dos repos

| Repo | Ruta | Rol |
|---|---|---|
| **Web (origen)** | `/home/thecorptech/Documents/Dev/bandes` | Plataforma web que se auditó y sirvió de base (Next.js en Vercel, login mock, `@vercel/blob`) |
| **Desktop (actual)** | `/home/thecorptech/Documents/Dev/bandes-desktop` | La migración: mismo dominio de negocio, empaquetado como app Windows con backend local |

En el repo web:
- `frontend/` = frontend activo (Next.js 16 App Router).
- `frontend1/` = **legacy de prueba (Pages Router / shadcn)** — NO usar como base.
- `backend/` = API NestJS.
- `ARCHITECTURE.md` / `CLAUDE.md` / `MD/` = auditoría y flujos documentados.

En el repo desktop:
- `frontend/` = UI (Next.js 16 **static export**) + `frontend/src-tauri/` (el shell Tauri).
- `backend/` = API NestJS empaquetada como **sidecar** `backend-api.exe`.
- `.github/workflows/build-windows.yml` = build CI de instaladores.
- `README.md`, `MANUAL-SRV.md`, `ERRORES-Y-SOLUCIONES.md` = operación y troubleshooting.
- `ARCHITECTURE.md` = ⚠️ **aún es la auditoría del web** (no refleja la arquitectura desktop; hay que actualizarlo).

> El frontend del desktop se deriva del `frontend/` del web: se copió el código y se adaptó
> (static export, auth real, blob local, base de API). No es un monorepo compartido: son dos
> repos independientes.

---

## 2. Qué hace el sistema (negocio)

**Trazabilidad de oro** para **BANDES / "Control Mining"** (bóveda multi-proveedor). Ciclo de vida:

1. **Ingreso / Packing:** recepción de barras por proveedor (registro individual o carga masiva desde Excel), con validación de pesos y purezas.
2. **Validación analítica:** la barra cruza de `POR_VALIDAR` → `IN_STOCK` al confirmarse peso, ley y fotografía.
3. **Fundición (Procesos y Lotes):** se agrupan barras en un proceso, se funden en lotes, se registra el peso recuperado (`recovered`) en balanza y se calibran ley/peso fino.
4. **Egreso (Despacho):** material refundido o barras sueltas se despachan a clientes (`MaterialExit` + `ExitDetail`) con trazabilidad barra↔lote↔proceso.
5. **Reportes y Dashboard:** conciliación, balance por proveedor, saldos, inventario de bóveda, procesos, egresos; exportación a **PDF** y **Excel**; métricas agregadas.

Contabilidad de custodia: el peso se rastrea del **peso bruto teórico (BI)** al **peso físico recuperado (BR)**, calculando mermas y saldos por proveedor.

---

## 3. Por qué la migración a desktop

- Operación **100% en red local**, sin depender de internet ni de Vercel.
- Cada equipo de la bóveda corre su propia instancia con **su propio sidecar local** (`127.0.0.1:3001`) conectado a una **BD central PostgreSQL en el SRV** de la red.
- Actualizaciones dentro de la LAN (servidor Caddy en el SRV) en vez de deploys en la nube.
- Control total del ambiente (Windows) y de la instalación por equipo.

---

## 4. Arquitectura resultante (desktop)

### 4.1 Frontend — Next.js 16 estático + Tauri v2

- **Stack:** Next.js 16 App Router + React 19 + TypeScript, Tailwind CSS v4, `motion`, `lucide-react`, `recharts`, TanStack React Query v5, axios, `jsPDF`/`jspdf-autotable`/`html-to-image`, `exceljs`.
- **Static export:** `frontend/next.config.ts` → `output: "export"`, `trailingSlash: true` (compatible con el asset protocol de Tauri), `images: { unoptimized: true }`. **No hay route handlers ni server**: el frontend habla directo con el sidecar vía axios.
- **API base:** `frontend/src/lib/api.ts` → `http://127.0.0.1:3001/api` (override con `NEXT_PUBLIC_API_URL`). Inyecta `Authorization: Bearer <token>` y redirige a `/login/` en 401.
- **Shell:** `frontend/src-tauri/` (Tauri v2, WebView2). La ventana se crea en `lib.rs` dentro de `.setup` con `WebviewWindowBuilder` (título "Bandes - Control Mining", 1440×900) para poder adjuntar el manejador de **descargas** (`on_download`), porque **WebView2 cancela silenciosamente las descargas** si no se registra.
- **Plugins Tauri:** `shell` (spawn sidecar), `updater`, `process` (relaunch tras update), `dialog`, `fs`.
- **CSP** (`tauri.conf.json`): `default-src 'self'`; `connect-src` permite `127.0.0.1:3001` (sidecar) y `192.168.88.162:8090` (updates).

### 4.2 Backend — NestJS 11 como sidecar local

- `backend/` es NestJS 11 (ESM) con Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`) sobre **PostgreSQL**.
- Módulos: `auth`, `clients`, `bars`, `packings`, `processes`, `lots`, `material-exits`, `reports`, `dashboard`, `blob`, `scale`.
- `src/main.ts`: prefijo `api`, CORS permite `localhost:3000` / `tauri.localhost`, puerto `3001` (`PORT`).
- Se empaqueta con **`@yao-pkg/pkg`** → `backend-api.exe` (node22-win-x64) y se renombra al target triple de Tauri: `frontend/src-tauri/binaries/backend-api-x86_64-pc-windows-msvc.exe`.
- El Tauri app lo espawnea en `lib.rs` (`app.shell().sidecar("backend-api")`) y reemite sus logs a la UI (`sidecar://log`).

### 4.3 Base de datos y secretos

- **BD central:** PostgreSQL en el **SRV** de la red → `192.168.88.162:5432` (la IP migró de `192.168.1.108` a `192.168.88.162`).
- **`DATABASE_URL` y `JWT_SECRET` se incrustan en el exe en build** (`backend/scripts/build-desktop.mjs`): prioridad `process.env` > `backend/.env`. En CI vienen de los **secrets de GitHub**.
- ⚠️ Si cambias de IP/BD: actualizar el secret `DATABASE_URL` de GitHub **antes** de compilar, y el `backend/.env` local (ver `ERRORES-Y-SOLUCIONES.md` §2).

### 4.4 Autenticación (cambio grande vs web)

- **Antes:** login mock en `localStorage` (web).
- **Ahora:** **JWT real** — `POST /api/auth/login` (bcrypt), guard por endpoint, token en `localStorage` (`bandes_token`) + rol en `bandes_user_role`.
- **Roles de usuario:** `SUPERADMIN | OWNER | ADMIN` (definidos en `frontend/src/context/RoleContext.tsx` como `UserRole`, y validados en `backend/src/scripts/seed-admin.ts`).
  - ⚠️ `backend/prisma/schema.prisma` tiene un comentario desactualizado que dice `ADMIN | OPERATOR | AUDITOR` — **no corresponde**; el set real son las 3 anteriores.
  - Hay además un concepto distinto: `ClientRole` (`PROVEEDOR | CLIENTE | AMBOS`) para clientes/proveedores (no confundir con roles de usuario).

### 4.5 Imágenes (cambio grande vs web)

- **Antes:** `@vercel/blob` (almacenamiento en la nube).
- **Ahora:** módulo local `blob` → las fotos (barras/lotes) se guardan como **bytea en la BD central**: `POST /api/blob/upload` y `GET /api/blob/view?url=...&token=...` (el guard acepta token por query para poder mostrarlas en `<img>`).

### 4.6 Báscula serial

- `serialport` v13. En Windows se usa un **shim determinista de `node-gyp-build`** (`dlopen`) con el `.node` nativo empaquetado dentro del exe (ver `ERRORES-Y-SOLUCIONES.md` §1).
- Configuración por `SCALE_PORT` / `SCALE_BAUD_RATE` (o `bandes.config.json` junto al exe). Se abre **bajo demanda** (un equipo sin balanza funciona normal).

### 4.7 Actualizaciones (LAN)

- **Tauri updater + minisign** (`tauri-plugin-updater`). `UpdaterBanner.tsx` (guarded por `isTauri`) chequea al abrir la app contra `http://192.168.88.162:8090/latest.json` (`dangerousInsecureTransportProtocol: true` porque es HTTP en LAN).
- El **SRV** corre **Caddy** sirviendo `C:\bandes-updates\` en el puerto `:8090`: ahí viven `latest.json`, `Bandes_<ver>_x64-setup.exe`, `.msi`, `.msi.sig`.
- El `latest.json` lo genera el CI y apunta al `setup.exe` con la URL del SRV.

### 4.8 Descargas PDF/Excel (fix reciente)

- Los reportes se generan **en el frontend** (jsPDF/exceljs). En Tauri v2/Windows, **WebView2 cancela las descargas si no hay manejador**.
- Fix: `on_download` en `lib.rs` (respaldo: guarda en la carpeta Descargas del usuario) + **diálogo nativo "Guardar como"** con los plugins `dialog`+`fs` vía `frontend/src/lib/saveFile.ts` (13 generadores: 8 PDF + 5 Excel). En navegador cae al anchor clásico. Ver `ERRORES-Y-SOLUCIONES.md` §8.

### 4.9 Cámara

- `frontend/src/components/tactical/CameraTerminal.tsx` usa `navigator.mediaDevices.getUserMedia` (captura de evidencia en Packing/Procesos).
- El permiso lo gestiona **Windows** (Privacidad → Cámara → "Permitir que las aplicaciones de escritorio accedan a la cámara") + el aviso nativo de **WebView2**. Si se denegó antes, se resetea borrando `%LOCALAPPDATA%\com.bandes.desktop\EBWebView`.

### 4.10 Build y CI

- `.github/workflows/build-windows.yml` (se dispara con **push a `main`**):
  1. Instala pnpm/Node/Rust; `pnpm desktop:build` en `backend/` (sidecar con secrets `DATABASE_URL`/`JWT_SECRET`).
  2. `pnpm tauri build` en `frontend/` (firma con `TAURI_SIGNING_PRIVATE_KEY`).
  3. Genera `latest.json` (firma minisign del setup) y sube el artifact **`bandes-installers.zip`**.
- **Distribución:** descargar el zip del run de Actions → reemplazar el contenido de `C:\bandes-updates` en el SRV → los clientes se auto-actualizan al abrir. (Pendiente de automatizar: deploy con runner self-hosted.)

---

## 5. Diferencias clave Web → Desktop

| Capa | Web (origen) | Desktop (actual) |
|---|---|---|
| Deploy | Vercel (frontend) + backend serverless | Instalador Windows (`Bandes.exe`) + sidecar local |
| Autenticación | Mock en localStorage | JWT real (bcrypt, guard por endpoint) |
| Imágenes | `@vercel/blob` | bytea en la BD central (`blob` module) |
| API base | Proxy `/api` (rewrite de Vercel) | `http://127.0.0.1:3001/api` directo (axios) |
| Báscula | `/dev/ttyUSB0` (Linux dev) | `SCALE_PORT` + shim `node-gyp-build` + `.node` empaquetado |
| Frontend server | Route handlers / SSR disponibles | **Static export** (sin server, `trailingSlash`) |
| Actualizaciones | Deploy en nube | Tauri updater + Caddy LAN (`:8090`) |
| BD | Cloud (Prisma serverless en web) | PostgreSQL central en el SRV LAN |

---

## 6. Cómo correr en local (Linux → navegador)

> El shell Tauri (`Bandes.exe`) **solo corre en Windows** (el sidecar es win-x64). En Linux se
> prueba el mismo código en **navegador**: el frontend detecta que no está en Tauri (`isTauri`)
> y activa fallbacks (descargas por anchor, auto-update desactivado, cámara con el aviso del
> navegador).

1. **BD:** opción aislada (recomendada para pruebas) — crear `bandes`/`bandes` en un PostgreSQL local y apuntar `backend/.env` a `127.0.0.1`; opción rápida — usar la BD del SRV (`192.168.88.162`) tal como está el `.env`.
2. **Backend:** `cd backend && pnpm exec prisma generate && pnpm start:dev` → `http://127.0.0.1:3001`.
3. **Frontend:** `cd frontend && pnpm dev` → `http://localhost:3000` → login con `admin`.
4. Migraciones iniciales: `pnpm exec prisma migrate deploy` + `ADMIN_PASSWORD=<pw> pnpm seed:admin`.

⚠️ **Revertir `backend/.env` a la IP del SRV antes de cualquier `desktop:build` local** (el build incrusta la URL del `.env` si no viene del entorno).

---

## 7. Estado actual y pendientes

**Hecho:**
- App desktop funcional en LAN, versión `0.1.6` publicada (SRV = `192.168.88.162`).
- Docs operativos: `README.md`, `MANUAL-SRV.md`, `ERRORES-Y-SOLUCIONES.md` (síntomas/causas/fix de: serialport, DATABASE_URL, procesos viejos en `:3001`, descargas, etc.).
- Fix de descargas (diálogo "Guardar como"), migración de IP `192.168.1.108 → 192.168.88.162`.

**Pendientes / próximos pasos (por orden de conversación):**
1. **Probar la app en local** (setup de BD local + backend + frontend, sección 6).
2. **Configurar roles de usuario** — mantener `SUPERADMIN | OWNER | ADMIN`; corregir el comentario desactualizado del schema; decidir permisos por rol en la UI/backend.
3. **Auto-deploy al SRV** — plan aprobado: runner self-hosted ligero en el SRV que descarga el artifact del CI y reemplaza `C:\bandes-updates` (job `deploy` en el workflow; verificación de firma minisign). No implementado aún.
4. **Actualizar `ARCHITECTURE.md`** del repo desktop (sigue siendo la auditoría del web) y corregir referencias a la subred (el SRV volvió a `192.168.88.0/24`) en docs/manual.

---

## 8. Comandos útiles

```bash
# Sidecar (Windows exe) desde backend/
pnpm desktop:build

# Seed / usuarios
ADMIN_PASSWORD=<pw> pnpm seed:admin
USER_USERNAME=x USER_PASSWORD=<pw> USER_ROLE=ADMIN pnpm user:add

# Verificación del sidecar (Windows)
Invoke-RestMethod -Uri http://127.0.0.1:3001/api/auth/login -Method Post -ContentType "application/json" -Body '{"username":"admin","password":"<pw>"}'

# Descarga del instalador desde el SRV
curl.exe -o Bandes_0.1.6_x64-setup.exe http://192.168.88.162:8090/Bandes_0.1.6_x64-setup.exe
```
