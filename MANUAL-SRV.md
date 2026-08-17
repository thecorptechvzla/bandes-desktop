# Bandes — Manual de instalación y configuración del SRV

Guía completa para levantar el servidor de Bandes **desde cero** en una red LAN
y mantenerlo (instalaciones, actualizaciones y clientes).

> SRV = servidor Windows de la red. Valores de referencia: `192.168.88.162`,
> subred `192.168.88.0/24`. Ajusta si tu red cambia.

---

## 1. Arquitectura (de un vistazo)

| Recurso | Valor |
|---|---|
| SRV (servidor Windows) | `192.168.88.162` |
| PostgreSQL (central) | `192.168.88.162:5432` |
| Servidor de updates (Caddy) | `http://192.168.88.162:8090` |
| Sidecar (local en cada PC) | `http://127.0.0.1:3001` |
| Subred LAN autorizada | `192.168.88.0/24` |

Cómo funciona:
- Cada PC instalado corre **su propio sidecar** (`backend-api.exe`, local en
  `127.0.0.1:3001`), que se conecta **directo a la BD central** del SRV
  (`192.168.88.162:5432`).
- Las actualizaciones se sirven desde el SRV vía Caddy (`8090`) leyendo
  `C:\bandes-updates\latest.json`; los clientes se auto-actualizan.
- Un PC cliente solo necesita alcanzar el SRV en los puertos `5432` y `8090`.

---

## 2. Instalar y configurar PostgreSQL (en el SRV)

1. Instalar PostgreSQL en Windows (instalador estándar de EDB).
2. Asegurar que escuche en todas las interfaces — en
   `C:\Program Files\PostgreSQL\<ver>\data\postgresql.conf`:
   ```
   listen_addresses = '*'
   ```
3. Crear la base y el usuario (como usuario `postgres`, en `psql`):
   ```sql
   CREATE USER bandes WITH PASSWORD 'postgres';
   CREATE DATABASE bandes OWNER bandes;
   ```
4. Permitir la subred LAN en `pg_hba.conf` — añadir la regla **arriba** de las
   reglas restrictivas:
   ```
   host    all    all    192.168.88.0/24    scram-sha-256
   ```
5. Reiniciar el servicio:
   ```powershell
   Restart-Service postgresql-x64-<ver>
   ```
6. Abrir el puerto en el firewall de Windows (`5432`) con alcance
   `RemoteAddress: 192.168.88.0/24`.

**Verificar desde el propio SRV:**
```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h 192.168.88.162 -p 5432
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgres://bandes:postgres@192.168.88.162:5432/bandes" -c "select 1;"
```

---

## 3. Instalar y configurar Caddy (servidor de updates)

### 3.1 (Recomendado) Asistente con interfaz gráfica

> Caddy **no implementa servicios de Windows nativo**, por eso se envuelve con
> **NSSM** en un servicio real (`BandesUpdates`) que corre en segundo plano
> (sesión 0, sin ventana), arranca solo al boot y se auto-reinicia si cae.

1. Copiar la carpeta `scripts/` del repo al SRV (contiene
   `caddy-service-setup.ps1` y `Iniciar-Configuracion-Caddy.bat`).
2. Doble clic en **`Iniciar-Configuracion-Caddy.bat`** (acepta la elevación a
   administrador).
3. En el asistente, pulsa **"Instalar / Reparar"**:
   - Si `nssm.exe` no está, el asistente **intenta descargarlo** (nssm.cc);
     si no hay internet muestra un mensaje claro pidiendo colocarlo
     manualmente en `C:\caddy\nssm.exe`.
   - Crea el servicio `BandesUpdates`, lo arranca y lo verifica
     (`sc.exe query` = RUNNING y `HTTP 200` en `latest.json`).
4. Abrir el puerto `8090` en el firewall (`RemoteAddress: 192.168.88.0/24`).
5. Opcional: marcar **"Descargar caddy.exe automáticamente"** si aún no hay
   `caddy.exe` en `C:\caddy\`.

El asistente también permite **Detener / Reiniciar / Desinstalar** el servicio y
**abrir los logs** (`C:\caddy\logs\caddy.out.log` y `caddy.err.log`).

**Verificar:**
```cmd
sc.exe query BandesUpdates
curl.exe -I http://192.168.88.162:8090/latest.json
```

### 3.2 (Fallback) Manual sin asistente

1. Copiar `caddy.exe` a `C:\caddy\`.
2. Crear la carpeta de updates:
   ```powershell
   New-Item -ItemType Directory -Force -Path C:\bandes-updates
   ```
3. Arrancar Caddy en consola (solo para pruebas; el modo recomendado es el
   servicio del §3.1):
   ```powershell
   C:\caddy\caddy.exe file-server --root C:\bandes-updates --listen :8090 --browse
   ```
4. Abrir el puerto `8090` en el firewall (`RemoteAddress: 192.168.88.0/24`).
5. (Recomendado) Registrar una tarea programada al inicio de sesión para que
   Caddy arranque solo — o mejor, el servicio del §3.1.

**Verificar:**
```cmd
curl.exe -I http://192.168.88.162:8090/Bandes_0.1.6_x64-setup.exe
```

---

## 4. Generar el instalador (release nuevo)

Se compila en GitHub Actions; todo se dispara con push a `main`.

Requisitos:
- `backend/.env` con `DATABASE_URL` y `JWT_SECRET`.
- Secrets de GitHub (`Settings → Secrets and variables → Actions`):
  - `DATABASE_URL` → `postgres://bandes:postgres@192.168.88.162:5432/bandes`
  - `JWT_SECRET`
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Pasos:
1. Commit + push a `main`.
2. Esperar el run del workflow `build-windows.yml` en **verde**.
3. Descargar el artifact `bandes-installers.zip` (contiene el `setup.exe`, el
   `.msi`, el `.msi.sig` y el `latest.json`).

> ⚠️ Si cambias `DATABASE_URL`, actualiza el secret **antes** de que corra el
> build del sidecar; de lo contrario el exe publicado quedará con la URL vieja
> (ver `ERRORES-Y-SOLUCIONES.md` §2).

---

## 5. Primera instalación en el SRV

1. Extraer `bandes-installers.zip` y copiar **todo el contenido** a
   `C:\bandes-updates\`:
   - `Bandes_<ver>_x64-setup.exe` (para repartir a clientes)
   - `Bandes_<ver>_x64_en-US.msi` + `.msi.sig` + `latest.json` (auto-update)
2. Instalar la app en el SRV con el **MSI** (instalación para todos los usuarios):
   ```powershell
   msiexec /i C:\bandes-updates\Bandes_<ver>_x64_en-US.msi /qb
   ```
   (Instala en `C:\Program Files\Bandes\`; el `setup.exe` instala por usuario en
   `%LOCALAPPDATA%\Bandes`.)
3. **Poblar la BD** (solo la primera vez, desde una máquina de desarrollo con el
   `.env` del backend):
   ```bash
   cd backend
   pnpm exec prisma migrate deploy
   ADMIN_PASSWORD=<password> pnpm seed:admin
   ```
4. Verificar el sidecar (en el SRV):
   ```powershell
   cd "C:\Program Files\Bandes"
   .\backend-api.exe
   ```
   Debe quedar logueando `Nest application successfully started` (Ctrl+C sale).
5. Probar el login:
   ```powershell
   Invoke-RestMethod -Uri http://127.0.0.1:3001/api/auth/login -Method Post -ContentType "application/json" -Body '{"username":"admin","password":"<password>"}'
   ```
   → debe devolver el token (200).
6. Abrir Bandes y entrar con `admin`.

> Si el puerto `3001` ya está ocupado al lanzar el sidecar (`EADDRINUSE`), hay
> procesos viejos de una instalación anterior: matarlos (ver
> `ERRORES-Y-SOLUCIONES.md` §3).

---

## 6. Subir una nueva versión a la red

1. Commit + push → nuevo `bandes-installers.zip`.
2. Descargar y **reemplazar** el contenido de `C:\bandes-updates\`.
3. Verificar:
   ```cmd
   curl.exe -I http://192.168.88.162:8090/latest.json
   ```
4. Los equipos ya instalados avisan solos y se actualizan desde el SRV. Para el
   SRV mismo, reinstalar el MSI (cerrar la app y matar `backend-api.exe` primero).

---

## 7. Instalar en un equipo cliente (operador)

Requisitos:
- Windows 10/11 x64, en la misma LAN `192.168.88.0/24`.
- **WebView2 Runtime** (el instalador lo descarga; si la máquina está offline,
  instalar el bootstrapper manualmente).
- Acceso de red al SRV (`5432` y `8090`).

Pasos:
1. Crear el usuario del operador (desde la máquina de desarrollo):
   ```bash
   cd backend
   USER_USERNAME=operador USER_PASSWORD=<password> USER_ROLE=ADMIN pnpm user:add
   ```
2. Verificar conectividad desde el PC cliente:
   ```powershell
   Test-NetConnection 192.168.88.162 -Port 5432
   Test-NetConnection 192.168.88.162 -Port 8090
   ```
   → ambos deben dar `True`.
3. Descargar e instalar el `setup.exe`:
   ```cmd
   curl.exe -o Bandes_0.1.6_x64-setup.exe http://192.168.88.162:8090/Bandes_0.1.6_x64-setup.exe
   Bandes_0.1.6_x64-setup.exe
   ```
   - Si SmartScreen bloquea: "Más información → Ejecutar de todas formas".
4. Abrir Bandes e iniciar sesión con el usuario del operador.
5. Si el equipo usa balanza, configurar el puerto (sección 9).

---

## 8. Usuarios de la aplicación

Los usuarios son de la **app** (no de Windows) y viven en la BD central. Crear
cada uno **una sola vez** desde una máquina de desarrollo:

```bash
cd backend
ADMIN_PASSWORD=<password> pnpm seed:admin   # crea/actualiza 'admin' (SUPERADMIN)
USER_USERNAME=operador USER_PASSWORD=<password> USER_ROLE=ADMIN pnpm user:add
```

| Rol | Alcance |
|---|---|
| `SUPERADMIN` | Control total (por defecto `admin`) |
| `OWNER` | Dueño |
| `ADMIN` | Administrador / operador |

---

## 9. Balanza (solo si el equipo la usa)

Por defecto se lee de `COM3` (Windows) o `/dev/ttyUSB0` (Linux). Para cambiarlo:

- Variable de entorno `SCALE_PORT=COM5`, **o**
- archivo `bandes.config.json` junto al `Bandes.exe`:
  ```json
  { "scalePort": "COM5" }
  ```

El puerto serial se abre **bajo demanda** (no al arrancar): un equipo sin balanza
funciona normal; solo `/api/scale/weight` no responderá.

---

## 10. Resumen de puertos / red

| Puerto | Servicio | Regla firewall |
|---|---|---|
| `5432` | PostgreSQL (BD central) | `192.168.88.0/24` |
| `8090` | Caddy (updates + instaladores) | `192.168.88.0/24` |
| `3001` | Sidecar local (solo loopback `127.0.0.1`) | no abrir |

---

## 11. Referencia

- Errores y soluciones: [`ERRORES-Y-SOLUCIONES.md`](./ERRORES-Y-SOLUCIONES.md)
- Arquitectura general: [`README.md`](./README.md)