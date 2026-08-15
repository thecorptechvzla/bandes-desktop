# Bandes — Errores y soluciones

Registro de errores reales encontrados durante la puesta en marcha de Bandes
(LAN) y cómo se resolvieron. Si aparece un síntoma nuevo, agrégalo aquí con
causa, solución y cómo verificarlo.

> Convenciones: `SRV` = servidor de la red (`192.168.1.108`); sidecar =
> `backend-api.exe` local en cada PC (`127.0.0.1:3001`).

---

## Resumen rápido

| Síntoma | Causa probable | Solución rápida |
|---|---|---|
| `backend-api.exe` crashea: `No native build was found … bindings-cpp` | Addon nativo de serialport no empaquetado por pkg | Ver **§1** (shim + dlopen, ya resuelto) |
| Login devuelve `PRISMA_P1001` / `Can't reach database server at base` | Secret `DATABASE_URL` malo o host inalcanzable | Ver **§2** |
| La app dice "No se pudo iniciar sesión. Verifique el sidecar y la red" | El sidecar no responde en `127.0.0.1:3001` | Ver **§3** |
| El sidecar se cuelga (curl conecta pero no responde) | Proceso viejo aún tomando el `:3001` | Ver **§3** |
| `EADDRINUSE: address already in use :::3001` al lanzar el sidecar | Ya hay otra instancia corriendo | Ver **§3** |
| `Cannot POST /api/auth/login` (404) en un equipo cliente | Sidecar viejo de instalación previa en el `3001` | Ver **§3** |
| Login responde `400: Expected property name or '}' in JSON` | El shell corrompió el JSON del curl | Ver **§4** |
| La app no avisa de actualizaciones | Falta `latest.json` en `C:\bandes-updates` | Ver **§5** |
| `http://192.168.1.108:8090/` muestra "No se puede encontrar esta página" | Caddy no usa `--browse` | Abrir un archivo concreto |
| El cliente no abre la app (sin WebView2) | Falta WebView2 Runtime | Instalar manualmente (offline) |
| `psql` no se reconoce como comando | `psql` no está en el PATH | Usar la ruta completa (ver **§6**) |
| `& was unexpected at this time` | Comando de PowerShell en CMD | Ver **§6** |
| `column "username" does not exist` | Las comillas de `"User"` las comió el shell | Ver **§6** |
| La BD está vacía / login falla por tablas faltantes | Migraciones y seed no aplicados | Ver **§7** |

---

## §1 — Sidecar crashea: `No native build was found … bindings-cpp`

**Síntoma:** al lanzar `backend-api.exe` en Windows, muere al instante con
`No native build was found for platform=win32 arch=x64 runtime=node abi=127 … @serialport/bindings-cpp`.

**Causa raíz:** el sidecar se empaqueta con `@yao-pkg/pkg` sobre el bundle CJS
de esbuild. El addon nativo de `serialport` (`@serialport/bindings-cpp`) **no
se incrustaba de forma confiable** cuando pkg resolvía paquetes de `node_modules`
con pnpm (ni con `node-linker=hoisted` ni con globs amplios en `pkg.assets`).
`node-gyp-build` no encontraba el `.node` en el snapshot y crasheaba.

**Solución (aplicada):** enfoque determinista que no depende del mapeo de
`node_modules` de pkg (`backend/scripts/build-desktop.mjs`):

1. `backend/pnpm-workspace.yaml` → `nodeLinker: hoisted`.
2. El build copia el prebuild de Windows a `dist/desktop/serialport.node`.
3. `backend/package.json → pkg.assets` incluye `dist/desktop/serialport.node`.
4. esbuild **inlinea** `@serialport/bindings-cpp` y sustituye `node-gyp-build`
   por el shim `backend/scripts/node-gyp-build-shim.cjs`, que hace
   `process.dlopen` probando rutas conocidas:
   `__dirname/serialport.node` → `process.cwd()/serialport.node` →
   `dir/prebuilds/win32-x64/*.node`.

**Regenerar:** `cd backend && pnpm desktop:build`.

**Verificar:** el exe contiene los strings del DLL nativo:
`node-serialport:OpenBaton`, `node-serialport:ListBaton`, etc.

> Trampa: buscar `napi_register_module_v1` en el exe da **falso positivo** (viene
> del runtime de Node de pkg, no del DLL). Los strings `node-serialport:*` son
> la prueba real.

---

## §2 — Login devuelve `PRISMA_P1001` ("Error en la operación de base de datos")

**Síntoma:** al hacer login el sidecar responde:
```json
{"statusCode":400,"error":"PRISMA_P1001","message":"Error en la operación de base de datos"}
```
`P1001` = **no se puede alcanzar el servidor de base de datos** (no confundir con
"faltan tablas", que sería `P2021`).

### Caso A — El secret `DATABASE_URL` estaba malo (host literal `base`)

El error en consola del sidecar decía:
```
Can't reach database server at base
```

**Causa:** la URL de BD se **incrusta en el exe** durante el build
(`build-desktop.mjs` da prioridad a `process.env` sobre `backend/.env`). El
workflow de CI la inyecta desde el secret de GitHub
(`.github/workflows/build-windows.yml` → `DATABASE_URL: ${{ secrets.DATABASE_URL }}`).
Si el secret tenía un valor inválido (p.ej. host `base`), el exe publicado quedó
con esa URL. Además, `$connect()` de Prisma es **perezoso**: el arranque loguea
"Conexión establecida correctamente" aunque la URL sea mala, y el fallo recién
aparece en el **primer query** (login).

**Solución:**
1. En GitHub → Settings → Secrets and variables → Actions → editar `DATABASE_URL`
   con el valor exacto (sin comillas ni saltos de línea):
   ```
   postgres://bandes:postgres@192.168.1.108:5432/bandes
   ```
2. Re-disparar el workflow "Build Windows" (Actions → run → Re-run) o hacer un
   commit/push nuevo.
3. Reemplazar `C:\bandes-updates` y **reinstalar** el MSI/setup en el SRV y en
   los clientes afectados.

**Cómo diagnosticar el host grabado en el exe:** ejecutar un login y leer la
línea `Can't reach database server at <host>` en la consola del sidecar (no
intentar extraer strings del exe: pkg comprime el payload y da ruido binario).

### Caso B — La URL es correcta pero PostgreSQL no responde

**Diagnóstico (desde el SRV):**
```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h 192.168.1.108 -p 5432
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgres://bandes:postgres@192.168.1.108:5432/bandes" -c "select 1;"
```
- Si `pg_isready` dice "no accepting connections" → revisar `listen_addresses = '*'`
  en `postgresql.conf` y reiniciar el servicio.
- Si psql falla → revisar `pg_hba.conf` (regla `host all all 192.168.88.0/24 scram-sha-256`
  **arriba** de las reglas restrictivas) y el firewall (`5432`, `RemoteAddress: 192.168.88.0/24`).

> Ojo: `Test-NetConnection`/`/dev/tcp` abierto **no** garantiza que PostgreSQL
> responda — solo que el TCP llega. Usa `pg_isready` para la prueba real.

---

## §3 — Sidecar no responde / cuelga / "Verifique el sidecar y la red"

**Síntomas relacionados:**
- La app al entrar: "No se pudo iniciar sesión. Verifique el sidecar y la red."
- `curl -v http://127.0.0.1:3001/api/clients` → conecta pero **0 bytes** (timeout).
- Al lanzar `backend-api.exe`: `Error: listen EADDRINUSE: address already in use :::3001`.
- En un equipo cliente: `Cannot POST /api/auth/login` (404 de Express).

**Causa más frecuente:** hay **procesos viejos de `backend-api.exe`** de una
instalación anterior que siguen corriendo y retienen el puerto `3001`. El
instalador nuevo **no puede reemplazar un exe en uso**, así que el sidecar viejo
(con una URL de BD vieja, una versión sin la ruta de auth, o colgado) sigue
atendiendo y el nuevo muere con `EADDRINUSE`. La app Tauri además espawnea su
propio sidecar al abrirse.

**Diagnóstico:**
```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Format-Table OwningProcess,LocalAddress
Get-Process backend-api -ErrorAction SilentlyContinue | Select Id,StartTime,Path
```

**Solución:**
1. Cerrar la app Bandes **por completo** (ella levanta su propio sidecar).
2. Matar todos los sidecar:
   ```powershell
   Get-Process backend-api -ErrorAction SilentlyContinue | Stop-Process -Force
   ```
3. Confirmar que el `3001` quedó libre:
   ```powershell
   Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
   ```
4. Reabrir la app (o lanzar el sidecar manualmente) y probar.
5. Si persiste → **desinstalar** la versión anterior y **reinstalar limpio** el
   `setup.exe`/MSI nuevo.

> Prueba de login sin líos de comillas (ver §4):
> ```powershell
> Invoke-RestMethod -Uri http://127.0.0.1:3001/api/auth/login -Method Post -ContentType "application/json" -Body '{"username":"admin","password":"<password>"}'
> ```

---

## §4 — curl devuelve `400: Expected property name or '}' in JSON`

**Síntoma:** el login responde rápido pero con:
```json
{"message":"Expected property name or '}' in JSON at position 1 (line 1 column 2)","error":"Bad Request","statusCode":400}
```
En el `Content-Length` se ve un tamaño raro (p.ej. 34 en vez de 42).

**Causa:** el **shell corrompe el body JSON**:
- En **CMD**, los `\"` se envían tal cual → JSON inválido.
- En **PowerShell 5.1**, las comillas dobles internas se **pierden** al pasar
  argumentos a exes nativos → el body queda `{username:admin,password:admin123}`.

**Solución (PowerShell, recomendada):**
```powershell
Invoke-RestMethod -Uri http://127.0.0.1:3001/api/auth/login -Method Post -ContentType "application/json" -Body '{"username":"admin","password":"<password>"}'
```
O con body desde archivo (funciona en cualquier shell):
```powershell
'{"username":"admin","password":"<password>"}' | Set-Content -Path body.json -Encoding ascii
curl.exe -H "Content-Type: application/json" -d "@body.json" http://127.0.0.1:3001/api/auth/login
```

---

## §5 — La app no avisa de actualizaciones (falta `latest.json`)

**Causa:** en Windows el updater de Tauri no emitía `latest.json` en el artifact
del workflow, así que el SRV no tenía el manifiesto y los clientes no sabían que
había versión nueva.

**Solución (aplicada):** el workflow genera `latest.json` **explícitamente**
después del build (`build-windows.yml` → paso "Generate latest.json for updater"):
firma el `setup.exe` con `pnpm tauri signer sign` (usa los secrets
`TAURI_SIGNING_PRIVATE_KEY` / `_PASSWORD`) y escribe el manifiesto con la URL
`http://192.168.1.108:8090/Bandes_<versión>_x64-setup.exe`.

**Verificar en el SRV:**
```cmd
curl.exe -I http://192.168.1.108:8090/latest.json
```

---

## §6 — Trucos de PowerShell/CMD para el SRV

| Error | Causa | Solución |
|---|---|---|
| `psql` no se reconoce | `psql` no está en el PATH | `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgres://bandes:postgres@192.168.1.108:5432/bandes" -c "..."` |
| `& was unexpected at this time` | Comando de PowerShell pegado en **CMD** | En CMD quitar el `&` y escribir la ruta entre comillas directa |
| `column "username" does not exist` | Las comillas de `"User"` las comió Windows al pasar `-c` | Pasar el SQL por **stdin**: `'select username, role, active from "User";' \| & "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgres://..."` |
| No encuentro el PostgreSQL | Versión/ubicación distinta | `Get-ChildItem "C:\Program Files\PostgreSQL" \| Select Name` |

---

## §7 — BD nueva (vacía): migraciones y seed

Cuando el SRV se levanta desde cero, la BD **no trae tablas** (Prisma no migra
al arrancar; `$connect` es perezoso). Hacer **una vez** desde una máquina de
desarrollo con el `.env` del backend:

```bash
cd backend
pnpm exec prisma migrate deploy   # aplica las migraciones → crea todas las tablas
ADMIN_PASSWORD=<password> pnpm seed:admin   # crea/actualiza 'admin' (SUPERADMIN)
```

Verificar:
```powershell
'select username, role, active from "User";' | & "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgres://bandes:postgres@192.168.1.108:5432/bandes"
```

Crear usuarios de operador:
```bash
USER_USERNAME=operador USER_PASSWORD=<password> USER_ROLE=ADMIN pnpm user:add
```

Roles válidos: `SUPERADMIN | OWNER | ADMIN` (no hay guards por rol todavía, así
que `ADMIN` basta para un operador).

---

## §8 — Los reportes no descargan (PDF/Excel "no hace nada")

**Síntoma:** al hacer clic en los botones PDF o EXCEL de un reporte (Saldos,
Packings, Procesos, Egresos, Bóveda…) no ocurre nada: sin error, sin archivo.

**Causa raíz:** los reportes se generan **en el frontend** y descargan por el
mecanismo estándar del navegador (`doc.save()` de jsPDF y
`URL.createObjectURL` + `a.click()` del Excel). En Tauri v2/Windows el webview
es **WebView2**, que **cancela silenciosamente toda descarga** a menos que la
app registre un manejador (`DownloadEvent`). La ventana se creaba desde
`tauri.conf.json`, sin manejador → el clic no hacía nada.

**Solución (aplicada):**
1. Los generadores ya **no** usan `doc.save()` ni `URL.createObjectURL`+`click()`.
   Ahora producen un `Blob` y llaman al helper `frontend/src/lib/saveFile.ts`:
   - En la app Tauri usa el plugin **dialog** → `save({ defaultPath })` abre el
     diálogo nativo **"Guardar como"** del sistema, y el plugin **fs** →
     `writeFile` escribe el archivo en la ruta elegida por el usuario.
   - Si el usuario cancela el diálogo, no se escribe nada.
   - En navegador (dev) cae al anchor clásico.
2. La ventana se crea en `frontend/src-tauri/src/lib.rs` (`.setup` +
   `WebviewWindowBuilder`) con `.on_download(...)` como **respaldo**: si algo
   llegara a descargarse por el webview, se guarda en **Descargas** del usuario.
3. Plugins habilitados: `tauri-plugin-dialog` y `tauri-plugin-fs` en
   `Cargo.toml` + `lib.rs`, y permisos `dialog:default` + `fs:allow-write-file`
   en `frontend/src-tauri/capabilities/default.json` (la ruta elegida en el
   diálogo se añade sola al scope de fs).
4. Paquetes JS: `@tauri-apps/plugin-dialog` y `@tauri-apps/plugin-fs`.

**Verificar:** abrir un reporte → clic en PDF o EXCEL → debe aparecer el
diálogo nativo de Windows "Guardar como" y el archivo se guarda donde el
usuario elija.

---

## Recomendaciones pendientes

- **Validación de `DATABASE_URL` en el build** (`backend/scripts/build-desktop.mjs`):
  rechazar URLs cuyo host no sea una IP/hostname válido, para que un valor tipo
  `base` **falle el build** con un mensaje claro en vez de publicarse en el exe.