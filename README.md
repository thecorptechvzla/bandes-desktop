# Bandes Desktop

Sistema de trazabilidad de fundición y bóveda de oro que opera **100% en red local (LAN)**.

- **Frontend**: Next.js (static export) + Tauri v2 → `Bandes.exe`
- **Backend**: NestJS 11 empaquetado como sidecar en el .exe → `backend-api.exe` (escucha en `127.0.0.1:3001`)
- **Base de datos**: PostgreSQL central en el SRV de la red
- **Actualizaciones**: auto-update dentro de la LAN (minisign + servidor Caddy en el SRV)
- **Build del instalador**: GitHub Actions (Windows) — `bandes-installers.zip`

---

## Arquitectura de red

| Recurso | Valor |
|---|---|
| SRV (servidor Windows) | `192.168.88.162` |
| PostgreSQL | `192.168.88.162:5432` |
| Servidor de updates (Caddy) | `http://192.168.88.162:8090` |
| Subred LAN autorizada | `192.168.88.0/24` |
| Sidecar (local en cada PC) | `http://127.0.0.1:3001` |

Cada PC cliente solo necesita alcanzar el SRV (`5432` y `8090`). **No necesita carpetas ni servicios locales**; el instalador crea todo solo.

---

## 1. Generar el instalador (release nuevo)

Los instaladores se compilan en GitHub Actions. TODO se dispara con un push a `main`.

1. En el repo, asegurar la configuración:
   - `backend/.env`: `DATABASE_URL` y `JWT_SECRET`.
   - Secrets de GitHub (`Settings → Secrets and variables → Actions`):
     - `DATABASE_URL`
     - `JWT_SECRET`
     - `TAURI_SIGNING_PRIVATE_KEY`
     - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
2. Commit + push a `main` → el workflow `build-windows.yml` genera `bandes-installers.zip` (contiene `Bandes_0.1.3_x64-setup.exe`, `Bandes_0.1.3_x64_en-US.msi`, `.msi.sig` y `latest.json`).
3. Esperar a que el run quede en **verde** y descargar el artifact.

---

## 2. Instalación en el SRV (uno solo, primera vez)

> Hacer SOLO en el servidor de la red (`192.168.88.162`).

### 2.1 PostgreSQL

1. Instalar PostgreSQL (Windows).
2. Crear la base y el usuario:
```sql
CREATE USER bandes WITH PASSWORD 'postgres';
CREATE DATABASE bandes OWNER bandes;
```
3. Permitir la subred LAN en `pg_hba.conf` (añadir arriba de la regla restrictiva):
```
host    all    all    192.168.88.0/24    scram-sha-256
```
4. Abrir el puerto en el firewall de Windows para `5432` (especificar `RemoteAddress: 192.168.88.0/24`).

### 2.2 Servidor de updates (Caddy)

1. Copiar `caddy.exe` a `C:\caddy\`.
2. Crear la carpeta de updates:
```powershell
New-Item -ItemType Directory -Force -Path C:\bandes-updates
```
3. Arrancar Caddy sirviendo esa carpeta:
```powershell
C:\caddy\caddy.exe file-server --root C:\bandes-updates --listen :8090 --browse
```
   - Abrir el puerto `8090` en el firewall (`RemoteAddress: 192.168.88.0/24`).
   - Registrar una tarea programada para que arranque con el inicio de sesión (opcional pero recomendado).

> El root y el puerto se gestionan desde aquí: toda la red descarga e instala updates desde esta URL.

### 2.3 Instalar la aplicación en el SRV

1. Extraer `bandes-installers.zip` del artifact.
2. Copiar al SRV todo el contenido del zip **a `C:\bandes-updates\`**:
   - `Bandes_0.1.3_x64-setup.exe` (para repartir a clientes)
   - `Bandes_0.1.3_x64_en-US.msi` + `Bandes_0.1.3_x64_en-US.msi.sig` + `latest.json` (para el auto-update)
3. En el SRV instalar con el **MSI** (instalación para todos los usuarios) o con `setup.exe` (por usuario):
   ```powershell
   msiexec /i C:\bandes-updates\Bandes_0.1.3_x64_en-US.msi /qb
   ```
4. Verificar que el sidecar arranca (no debe crashear):
   ```powershell
   cd "$env:LOCALAPPDATA\Bandes"
   .\backend-api.exe
   ```
   Debe quedarse corriendo y loguear `Nest application successfully started` (Ctrl+C para salir).
5. Probar el login directo contra el sidecar:
   ```powershell
   curl.exe -X POST http://127.0.0.1:3001/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"<tu-password>\"}"
   ```
   → debe responder `200`/`401` con JSON (no error de conexión).
6. Abrir Bandes y entrar con el usuario administrador.

### 2.4 Usuario administrador (si no existe)

Desde una máquina de desarrollo con acceso al `.env` del backend:
```bash
cd backend
ADMIN_PASSWORD=xxxx pnpm seed:admin   # crea/actualiza 'admin' con rol SUPERADMIN
```
Variables opcionales: `ADMIN_USERNAME` (default `admin`), `ADMIN_ROLE` (default `SUPERADMIN`).

---

## 3. Subir una nueva versión a la red (release cycle)

1. Desarrollar y hacer commit + push a `main` → `bandes-installers.zip` nuevo.
2. Descargar el zip y **reemplazar** el contenido de `C:\bandes-updates\` (`.msi`, `.msi.sig`, `latest.json`).
3. Verificar: `curl.exe -I http://192.168.88.162:8090/latest.json` → `200 OK`.
4. Los equipos ya instalados **avisarán solos** y se actualizarán desde el SRV (auto-update LAN).

---

## 4. Instalación en un equipo cliente

> En el PC del usuario final, dentro de la misma LAN (`192.168.88.0/24`).

### Requisitos
- Windows con WebView2 Runtime (el instalador lo descarga automáticamente — requiere internet solo en ese momento).
- Acceso de red al SRV.

### Pasos

1. Verificar conectividad con el SRV:
```powershell
Test-NetConnection 192.168.88.162 -Port 5432
Test-NetConnection 192.168.88.162 -Port 8090
```
   → ambos deben dar `True`.

2. Descargar e instalar (como el usuario que usará la app):
```powershell
cd "$env:USERPROFILE\Downloads"
curl.exe -O http://192.168.88.162:8090/Bandes_0.1.3_x64-setup.exe
.\Bandes_0.1.3_x64-setup.exe
```
   - El instalador crea `%LOCALAPPDATA%\Bandes` (`Bandes.exe` + `backend-api-x86_64-pc-windows-msvc.exe`) y el acceso directo en el menú.
   - Si SmartScreen bloquea: "Más información → Ejecutar de todas formas".

3. Abrir Bandes e iniciar sesión (crear el usuario de la app antes — ver sección 5).

4. (Clientes) La balanza se configura si hace falta — ver sección 6.

---

## 5. Usuarios de la aplicación

Los usuarios son de la **app** (no de Windows) y viven en la BD central. Crear cada usuario

**una sola vez** desde una máquina de desarrollo con el `.env` del backend:

```bash
cd backend
USER_USERNAME=operador USER_PASSWORD=xxxx USER_ROLE=OWNER pnpm user:add
```

| Rol | Alcance |
|---|---|
| `SUPERADMIN` | Control total (por defecto `admin`) |
| `OWNER` | Dueño |
| `ADMIN` | Administrador |

---

## 6. Balanza (solo si el equipo la usa)

Por defecto la balanza se lee de `COM3` (Windows) o `/dev/ttyUSB0` (Linux). Para cambiar el puerto:

- Variable de entorno `SCALE_PORT=COM5`, **o**
- archivo `bandes.config.json` junto al `Bandes.exe`:
```json
{ "scalePort": "COM5" }
```

---

## 7. Solución de problemas

| Síntoma | Causa probable | Acción |
|---|---|---|
| "No se puede encontrar esta página" al abrir `http://192.168.88.162:8090/` | Caddy sirve archivos, no listado (a menos que se use `--browse`) | Abrir la URL de un archivo concreto; o relanzar Caddy con `--browse` |
| La app abre pero al entrar dice "Verifique el sidecar y la red" | El sidecar murió (binding nativo sin empaquetar, etc.) | `cd $env:LOCALAPPDATA\Bandes; .\backend-api.exe` y leer el error de consola |
| `backend-api.exe` crashea con "No native build was found… bindings-cpp" | El addon serialport no se incluyó en el empaquetado (pnpm) | Verificar `package.json → pkg.assets` con el path `.pnpm/@serialport+bindings-cpp@13.0.0/…` y regenerar |
| Error de conexión a PostgreSQL | Firewall, `pg_hba.conf` o subred distinta a `192.168.88.0/24` | Verificar regla `5432` y `RemoteAddress` |
| La app no avisa de actualizaciones | Falta `latest.json` en `C:\bandes-updates` | Reemplazar el contenido del zip nuevo |
| Sin WebView2 en el cliente | Instalador no lo descargó | Instalar WebView2 Runtime manualmente |

---

## Convenciones del repo

- `.env` nunca se commitea (excluidos por `.gitignore`); solo está el `.env` local del backend.
- El sidecar se compila con `backend/scripts/build-desktop.mjs` (`pnpm desktop:build`) inyectando `DATABASE_URL` y `JWT_SECRET` en el binario.
- `frontend/src-tauri/binaries/backend-api-x86_64-pc-windows-msvc.exe` es el sidecar que empaqueta Tauri (`externalBin`).
- Auto-update LAN: Tauri configura `dangerousInsecureTransportProtocol: true` porque el endpoint local es `http://`; los paquetes van firmados con minisign (no se puede inyectar un update falsificado sin la clave privada).