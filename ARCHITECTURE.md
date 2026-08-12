# ARCHITECTURE.md — Sistema Bandes (Trazabilidad de Fundición y Bóveda de Oro)

> **Propósito de este documento:** Auditar y documentar la arquitectura actual de la plataforma Web
> (Frontend + Backend) para que sirva como contexto base de ingestión para agentes de IA y
> desarrolladores, y como punto de partida para una futura **migración a aplicación de escritorio (Desktop)**.
>
> **Fuente de verdad técnica:** código en `frontend/` y `backend/`, `backend/prisma/schema.prisma`.
> **Fecha de la auditoría:** agosto 2026.

---

## 1. Resumen Ejecutivo (Executive Summary)

### 1.1 Propósito del sistema

**Bandos / "Control Mining"** es un sistema de **trazabilidad de oro** (gold traceability) construido
para **BANDES** (Banco de Desarrollo Económico y Social de Venezuela). Cubre el ciclo de vida completo
del oro fino en una **bóveda multi-proveedor**:

1. **Ingreso / Packing:** recepción física de barras de oro por proveedor, registro individual o carga
   masiva desde **Excel**, con validación de pesos y purezas.
2. **Validación analítica:** cada barra cruza de `POR_VALIDAR` a `IN_STOCK` al confirmarse peso, ley y
   fotografía.
3. **Fundición (Procesos y Lotes):** se agrupan barras en un **proceso** de fundición, se funden en
   **lotes**, se registra el **peso recuperado** (`recovered`) en balanza y se calibran ley y peso fino.
4. **Egreso (Despacho):** el material refundido (lotes) o barras sueltas se despachan a clientes,
   generando `MaterialExit` + `ExitDetail` con trazabilidad barra↔lote↔proceso.
5. **Reportes y Dashboard:** conciliación, balance por proveedor, saldos, inventario de bóveda,
   procesos y egresos, exportados a **PDF** y **Excel**, más métricas agregadas en tiempo casi real.

El sistema mantiene una **contabilidad de custodia**: todo peso se rastrea desde el **peso bruto
teórico de entrada (BI)** hasta el **peso físico recuperado (BR)**, calculando **mermas** y saldos por
proveedor.

### 1.2 Stack tecnológico actual

| Capa | Tecnología | Detalle |
|---|---|---|
| **Frontend (activo)** | Next.js 16 (App Router) + React 19 + TypeScript | Monorepo `pnpm`. CSS: Tailwind CSS v4 (`@tailwindcss/postcss`) |
| **Animaciones / UI** | `motion` (Framer Motion v12), `lucide-react` | Gráficos: `recharts` v3 |
| **Estado asíncrono** | TanStack React Query v5 | `useQuery` / `useMutation` con invalidación por queryKey |
| **Estado local** | Context + `localStorage` | Contextos legacy (`GoldTraceabilityContext`, `RoleContext`) |
| **HTTP client** | Axios → base `/api` | Proxy hacia el backend (rewrite + route handler) |
| **Generación PDF** | `jsPDF` + `jspdf-autotable`, `html-to-image` | Extracción a HTML→PNG para un reporte legacy |
| **Generación Excel** | `exceljs` | Workbook con marca BANDES |
| **Backend** | NestJS 11 (+ Express) + TypeScript ESM | Módulos por dominio, `@nestjs/*` 11.x |
| **ORM / BD** | Prisma 7 (`@prisma/client`) con `@prisma/adapter-pg` | **PostgreSQL** |
| **Lectura de báscula** | `serialport` v13 + `@serialport/parser-readline` | Puerto serial `/dev/ttyUSB0` (env `SCALE_PORT`) |
| **Archivos/imágenes** | `@vercel/blob` (almacenamiento privado) | Fotos de barras/lotes proxyadas por el frontend |
| **Deploy objetivo** | Vercel (frontend) + backend serverless/Node | No hay autenticación real; login mock en `localStorage` |

---

## 2. Estructura de Directorios (Folder Structure)

### 2.1 Raíz del monorepo

```
bandes/
├── backend/
├── frontend/            # Web activa (Next.js 16 App Router)
├── frontend1/           # Prototipo/experimental legacy (Pages Router + shadcn-ui) — NO usar como base
├── MD/                  # Flujos documentados (carga masiva, etc.)
├── .opencode/plans/     # Planes de integración
├── CLAUDE.md            # Guía IA de alto nivel
└── pnpm-workspace.yaml / package.json
```

> ⚠️ **`frontend1/` es código legacy de prueba** (App Router anterior / Pages Router). El frontend
> activo es `frontend/`. Cualquier migración debe partir de `frontend/`.

### 2.2 `backend/`

```
backend/
├── prisma/
│   ├── schema.prisma        # ← FUENTE DE VERDAD del modelo de datos
│   └── migrations/          # Migraciones SQL versionadas (PostgreSQL)
├── src/
│   ├── main.ts              # Bootstrap: prefix "api", CORS, ValidationPipe, PrismaExceptionFilter, puerto 3001
│   ├── app.module.ts        # Registro raíz de módulos (Prisma + 9 módulos de dominio)
│   ├── common/
│   │   └── filters/prisma-exception.filter.ts   # Traducción de errores Prisma → HTTP
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts                     # PrismaClient + PrismaPg (connection pool 10)
│   ├── modules/
│   │   ├── clients/          # Proveedores/Clientes (CRUD + balance)
│   │   ├── bars/             # Barras (CRUD + carga masiva Excel + bulk-upload)
│   │   ├── processes/        # Procesos de fundición (creación full, cancelación, lotes disponibles)
│   │   ├── lots/             # Lotes (CRUD, calibración recovered/purity/fineWeight)
│   │   ├── material-exits/   # Egresos (por lotes, por barras o mixto; trazabilidad)
│   │   ├── packings/         # Packings (validación de barras, finalización)
│   │   ├── reports/          # PDFs server-side con PDFKit (legacy del backend)
│   │   ├── dashboard/        # Métricas agregadas + flujo diario (raw SQL)
│   │   └── scale/            # Lectura de báscula por puerto serial
│   └── scripts/
│       └── normalize-purity.ts   # Migra purezas en escala fracción → ‰ (*1000)
└── test/                  # e2e de Nest
```

Cada módulo sigue el patrón NestJS: `controller` (rutas HTTP) → `service` (lógica) → `dto/` (validación
con `class-validator`, sólo en `clients`; el resto valida inline en el body).

### 2.3 `frontend/`

```
frontend/
├── app/                          # App Router de Next.js
│   ├── layout.tsx                # Shell global: sidebar, header, providers, guard de sesión
│   ├── page.tsx                  # Redirección / → /dashboard o /login
│   ├── globals.css               # Tokens CSS "hud-*" (tema oscuro, palette BANDES)
│   ├── login/page.tsx            # Login mock
│   ├── dashboard/page.tsx        # Métricas, KPIs, treemap, gráficas
│   ├── clientes/page.tsx         # CRUD proveedores
│   ├── packing/page.tsx          # Registro individual + carga masiva + validación
│   ├── procesos/page.tsx         # Matriz de procesos activos / completados
│   ├── egresos/page.tsx          # Despacho de material (lotes/barras) + historial
│   ├── reportes/
│   │   ├── packing/page.tsx
│   │   ├── procesos/page.tsx
│   │   ├── egresos/page.tsx
│   │   ├── saldos/page.tsx      # Balance por proveedor (BI/BR/Merma)
│   │   └── inventario/page.tsx  # Bóveda (refundido / sin refundir)
│   ├── historicos/               # Consolidado / Balance / Barras
│   └── api/
│       ├── [...path]/route.ts              # Proxy genérico → backend (catch-all)
│       └── blob/{upload,view}/route.ts     # Subida/lectura de @vercel/blob
├── src/
│   ├── components/
│   │   ├── ui/                   # ModalShell, ConfirmDialog, EmptyState, LoadingSpinner, StatusBadge
│   │   ├── dashboard/            # KpiCardGrid, TreemapPanel, charts, modales (Boveda, Proceso, Evidence…)
│   │   ├── clientes/             # ClientTable, ClientFormModal, ClientFilterBar
│   │   ├── packing/              # BarRegistrationForm, BulkUploadSection, ValidationDetailPanel, PinPadModal…
│   │   ├── procesos/             # ActiveProcessesMatrix, SmeltingConfigForm, RecoveryModal, ProcessAuditModal…
│   │   ├── egresos/              # UnifiedItemPanel, CheckoutSummaryPanel, ConfirmDispatchModal, ExitsHistoryView…
│   │   ├── reportes/             # por reporte (filters, header, metrics, table, PDF template) + ExportButtons, MetricCard
│   │   ├── historicos/           # HistoryFilters, ExitsTable, PackingsTable
│   │   ├── selection/            # BarAccordion
│   │   └── tactical/             # CameraTerminal, HudButton (modo "táctico" legacy)
│   ├── context/
│   │   ├── GoldTraceabilityContext.tsx   # Contexto legacy con store en localStorage + datos demo
│   │   └── RoleContext.tsx                # Roles ADMIN/OWNER/SUPERADMIN (sin consumo en vistas)
│   ├── hooks/                   # useBars, useProcesses, useExits, useLots, usePackings, useClients, useDashboardMetrics, reportes…
│   ├── lib/
│   │   ├── api.ts               # Instancia Axios + apiUpload + interceptor de errores
│   │   ├── auth.ts              # getSession/setSession/clearSession (localStorage)
│   │   ├── format.ts            # formatWeight, formatLey, formatRif, fetchLogoAsBase64
│   │   ├── composition.ts       # computeComposition por proveedor
│   │   ├── prorateEgresoBR.ts   # ★ Prorrateo de BR en lotes mixtos (contabilidad)
│   │   └── generate{*Report}PDF.ts / generate{*Report}Excel.ts # Generadores jsPDF/exceljs
│   └── types/                   # api.ts (tipos de API), egresos.ts, types.ts (legacy)
└── public/                      # Assets estáticos (logo, video login)
```

**Responsabilidades clave:**

- `src/hooks/*`: encapsulan AXIOS + React Query; son la **única vía** de lectura/escritura del estado del
  servidor desde las vistas.
- `src/components/<dominio>/*`: vistas de tablero por flujo (packing/procesos/egresos/reportes).
- `src/components/ui/ModalShell`: contenedor de modales reutilizable (sizes sm–xl, backdrop blur,
  bloqueo de scroll, animación `motion`).
- `src/lib/generate*`: generación de PDF/Excel **en el cliente** (descargas directas del navegador).
- `app/(rutas)`: páginas; cada una compone filtros + tablas + exportadores.
- `app/api/*`: rutas server-side de Next:
  - `[...path]` → proxy hacia el backend (mantiene CORS inyectado y timeout de 15 s).
  - `blob/*` → subida y lectura de imágenes privadas desde **Vercel Blob**.

---

## 3. Arquitectura del Frontend (Frontend Architecture)

### 3.1 Routing — App Router de Next.js

- **App Router** (`app/`), todas las páginas son **Client Components** (`'use client'`).
- El `layout.tsx` monta: `QueryClientProvider` (React Query), `GoldTraceabilityProvider`,
  sidebar/header/footer y el **guard de sesión**.
- **Guard de sesión (mock):** `auth.ts` guarda `{ username, loginAt }` en `localStorage`
  (`bandes_session`). En cada cambio de ruta, el layout redirige a `/login` si no hay sesión y a
  `/dashboard` si ya hay sesión (layout.tsx:105-115).
- **Navegación:** menú principal (`Sidebar`) con items: Dashboard, Proveedores, Packing, Procesos,
  Egresos, Reportes; Reportes tiene **submenú** (Packing/Procesos/Egresos/Balance/Bóveda). La ruta
  `historicos/*` está oculta en el menú (comentada).
- `app/page.tsx` re-dirige según sesión; no hay contenido propio.

### 3.2 Manejo del Estado (State Management)

| Tipo | Mecanismo | Dónde |
|---|---|---|
| **Estado del servidor** | **TanStack React Query v5** (`useQuery`/`useMutation`) | Todos los flujos reales |
| **Config global** | `QueryClient` singleton en `app/layout.tsx` | `staleTime: 10 s`, `gcTime: 5 min`, `retry 0/1`, sin refetch on focus/reconnect |
| **Estado de sesión** | localStorage custom (`lib/auth.ts`, `lib/context` legacy) | Guard de rutas |
| **Estado local legacy** | `GoldTraceabilityContext` (localStorage + `gold-initial-data`) | Montado globalmente pero **no usado** por vistas reales (demo legacy) |
| **Roles** | `RoleContext` (ADMIN/OWNER/SUPERADMIN) | Definido pero sin consumidores en vistas |

> ❗ **Nota de refactor:** `GoldTraceabilityContext` y `RoleContext` son **vestigios** de una versión
> demo (calculan `FA = BI × (ley/1000)`, `FE = FA × 0.99`, etc. sobre datos en memoría). Los flujos
> productivos usan exclusivamente React Query + backend. No replicar estos contextos en la migración.

### 3.3 Patrones UI

- **`ModalShell`** (`src/components/ui/ModalShell.tsx`): patrón modal estándar. API: `isOpen`, `onClose`,
  `title`/`subtitle`/`header`/`footer`, `size` (`sm|md|lg|xl`), `noHeader`, `noPadding`,
  `closeOnBackdrop`, `hideCloseButton`, `zIndex`. Implementa **bloqueo de scroll del body**
  (`useBodyScrollLock`) y animaciones con `motion` (`AnimatePresence`). Todos los modales del sistema
  (confirmación de registros, despacho, recuperación de lotes, etc.) lo usan.
- **Paneles:** `PanelCard`, `CheckoutSummaryPanel`, `BarInventoryPanel`, etc. usan tokens CSS `hud-*`
  (tema oscuro tipo "HUD") y `glass-panel`.
- **Vistas principales:**
  - **Dashboard:** `KpiCardGrid` (KPIs oro recibido/en proceso/en bóveda/merma), `TreemapPanel`
    (participación por proveedor), `FlowAreaChart` (flujo diario ingresos/egresos),
    `InventoryDonutChart`, `ClientBalancesBarChart`, __modales__ de detalle (`BovedaModal`,
    `ProcesoModal`, `EvidenceModal`, `ExitedBarsModal`, `SupplierDirectoryModal`).
  - **Packing:** pestañas (`PackingTabBar`), `PackingListSidebar`, `BarRegistrationForm`,
    `BulkUploadSection` (solicitud de archivo xlsx/csv), `BulkUploadConfirm*`, `ValidationDetailPanel`
    (validación barra a barra con PIN `PinPadModal` y lectura de balanza), `BarDetailModal`,
    overlays de estado (`IngestStatusOverlay`, `DeleteStatusOverlay`, `FinalizeConfirmationModal`).
  - **Procesos:** `ActiveProcessesMatrix` (malla de procesos activos), `SmeltingConfigForm`
    (selección de barras, molde, operador), `RecoveryModal` (registro de peso recuperado),
    `ProcessAuditModal`, `CompletedProcessesSection`, `HardwareSyncOverlay`,
    `DeviceSimulationModal` (simula báscula sin hardware).
  - **Egresos:** selección unificada de lotes y barras (`UnifiedItemPanel`),
    `CheckoutSummaryPanel` (resumen BI/BR/merma/fino), `ConfirmDispatchModal`,
    `DispatchSuccessOverlay`, historial (`ExitsHistoryView`, `LotDetailModal`).
  - **Reportes:** por cada reporte: `*ReportFilters` (fechas+cliente+tipo) → `*ReportMetrics`
    (tarjetas KPI) → `*ReportTable` (resumen) o `*ReportDetailTable` (detallado) → botones de
    exportación (`ExportButtons`) usando `lib/generate{...}PDF/Excel`.

### 3.4 Generación de Reportes

Toda la generación de reportes ocurre **en el cliente** (el backend tiene reportes PDFKit legacy que
no se usan en el frontend activo). Dos estrategias:

1. **HTML→Imagen (legacy, `generateReportPDF.ts`):** captura el DOM (`#report-content`) con
   `html-to-image` (`toPng`), lo embebe en `jsPDF` como imagen. Usado por el reporte de **conciliación**
   del dashboard.
2. **Procedural `jsPDF` + `autoTable` (estándar actual):** los reportes de Saldos, Procesos, Egresos,
   Packing y Bóveda se construyen dibujando: membrete BANDES (RIF G-20001643-0), bloque de título
   verde, metadatos de filtros (ID de documento, fechas, proveedor), tarjetas KPI, tablas con
   `jspdf-autotable` (con cabeceras, zebra, filas de totales) y pie de página con paginación.
   Descarga vía `doc.save(...)`.
3. **Excel con `exceljs`:** genera `Workbook` con hoja titulada (título fusionado, estilo corporativo
   verde), encabezados, filas de totales y formato numérico. Descarga creando un `Blob` +
   `URL.createObjectURL` + clic en un `<a download>` + `revokeObjectURL`.

`src/components/reportes/<tipo>/types.ts` define los DTOs del reporte (resumido vs detallado).

---

## 4. Fetching de Datos (Data Fetching & API Integration)

### 4.1 Comunicación Frontend ↔ Backend

```
UI → useQuery/useMutation (React Query) → api (axios) → /api/... 
   → next.config rewrites O app/api/[...path]/route.ts (proxy) → http://BACKEND_URL/api/...
   → NestJS Controller → Service → PrismaService → PostgreSQL
```

- `api.ts`: `baseURL = NEXT_PUBLIC_API_URL || '/api'`, headers JSON, interceptor que loguea errores.
- En **dev**, `next.config` reescribe `/api/:path*` → `BACKEND_URL` (por defecto
  `http://127.0.0.1:3001`), excepto rutas `/api/blob/*`.
- También existe el **catch-all route handler** `app/api/[...path]/route.ts` que proxya cualquier
  método (GET/POST/PATCH/PUT/DELETE) con timeout de 15 s — funciona como capa de respaldo y en
  producción Vercel.
- Las **imágenes** (fotos de barras y lotes) se almacenan en **Vercel Blob** (privado) y se sirven por
  `app/api/blob/view?url=...`; su subida pasa por `app/api/blob/upload` (`put`).

### 4.2 Hooks principales y endpoints que consumen

| Hook | Endpoint (REST, prefijo `/api`) | Uso |
|---|---|---|
| `useBars(filters)`, `useBar(id)` | `GET /bars`, `GET /bars/{id}` | Inventario de barras |
| `useCreateBar` | `POST /bars` | Registro individual |
| `useUpdateBar` | `PATCH /bars/{id}` | Validar/corregir peso, ley, foto |
| `useBulkUploadBars` | `POST /bars/bulk-upload` (`multipart`) | Carga masiva desde Excel |
| `useClients({role})`, `useClient`, `useClientBalance` | `GET /clients`, `GET /clients/{id}/balance` | Proveedores y saldos |
| `useCreateClient/useUpdateClient/useDeleteClient` | `POST/PATCH/DELETE /clients[/{id}]` | CRUD proveedores |
| `useProcesses`, `useProcess`, `useProcessesByClient` | `GET /processes`, `/processes/{id}`, `/processes/client/{clientId}` | Procesos |
| `useCreateProcess` | `POST /processes/full` | Crear proceso + lote + asignar barras |
| `useUpdateProcess` / `useCancelProcess` | `PATCH /processes/{id}` / `PATCH /processes/{id}/cancel` | Cerrar/cancelar |
| `useAvailableLots(clientId)`, `useAvailableLotsGlobal` | `GET /processes/available-lots[/{clientId}]` | Lotes disponibles para egreso |
| `useLots`, `useLot`, `useLotsByProcess` | `GET /lots`, `/lots/{id}`, `/lots/process/{processId}` | Lotes |
| `useCreateLot`, `useUpdateLot` | `POST/PATCH /lots[/{id}]` | Crear/calibrar lote (recovered, purity, fineWeight) |
| `useMaterialExits`, `useTraceability(id)` | `GET /material-exits`, `GET /material-exits/{id}/traceability` | Egresos y trazabilidad |
| `useCreateMaterialExit` | `POST /material-exits` | Egreso (lotes y/o barras) |
| `usePackings`, `usePacking` | `GET /packings`, `/packings/{id}` | Packings |
| `useCreatePacking`, `useValidatePacking`, `useFinalizePacking` | `POST /packings`, `POST /packings/{id}/validate`, `POST /packings/{id}/finalize` | Ciclo de packing |
| `useDashboardMetrics(filters)` | `GET /dashboard/metrics?startDate&endDate&supplierId&clientId` | KPIs dashboard (poll cada 30 s) |
| `useBulkUploads` | `GET /bulk-uploads` (fallback a datos mock si falla) | Historial de cargas |
| `fetchPackingReport` | `GET /packings/report?from&to&type&clientId` | Reporte Packing |
| `fetchProcesosReport` | `GET /processes/report?from&to&type&clientId` | Reporte Procesos |
| `fetchEgresosReport` | `GET /material-exits/report?from&to&type&clientId` | Reporte Egresos |
| `computeSaldosReport` | **Sin endpoint** — calcula **en cliente** con `clients+bars+lots+exits+packings` | Reporte de Saldos por proveedor |
| `fetch('/api/scale/weight')` | `GET /scale/weight` (backend serial) | Lectura de báscula (BarDetailModal) |
| `POST /api/blob/upload`, `GET /api/blob/view` | Route handlers Next | Fotos |

### 4.3 Invalidación de caché tras mutaciones

Cada `useMutation` invalida las queries afectadas con `queryClient.invalidateQueries({ queryKey })`.
Regla general: **cualquier mutación sobre una entidad invalida también todo lo derivado de ella**.

| Mutación | QueryKeys invalidados |
|---|---|
| `useCreateBar` / `useBulkUploadBars` | `['bars']`, `['clients']`, `['packings']` |
| `useUpdateBar` | `['bars']`, `['packings']` |
| `useCreateProcess` | `['processes']`, `['bars']`, `['lots']` |
| `useUpdateProcess` / `useCancelProcess` | `['processes']`, `['bars']`, `['available-lots']` (+ `['lots']`) |
| `useCreateMaterialExit` | `['material-exits']`, `['bars']`, `['clients']`, `['available-lots']`, `['processes']`, `['lots']`, `['dashboard']` |
| `useUpdateLot` | `['lots']`, `['processes']`, `['available-lots']` |
| `useValidatePacking` / `useFinalizePacking` | `['packings']`, `['bars']` |
| `useCreateClient/Update/DeleteClient` | `['clients']` (+ `['bars']` en el hook de barras) |

> El dashboard usa `refetchInterval: 30 s` cuando ya hay data cargada (polling suave); no hay websockets.

---

## 5. Arquitectura del Backend (Backend Architecture)

### 5.1 Framework y módulos

- **NestJS 11** con `express`, TypeScript **ESM** (`"type": "module"`, imports `./x.js`).
- **Bootstrap** (`main.ts`): `setGlobalPrefix('api')`, CORS limitado a
  `http://localhost:3000`, `https://controlmining.vercel.app` y `FRONTEND_URL`;
  `ValidationPipe({ whitelist, transform })` global; `PrismaExceptionFilter` global
  (traduce errores conocidos de Prisma a respuestas HTTP limpias).
- **Capa por dominio:** `Controller` (rutas) → `Service` (lógica) → DTOs (validación). El módulo
  `PrismaModule` es global y provee `PrismaService` con pool `pg` (máx. 10).
- **Lectura de báscula** (`scale`): abre el puerto serial (`SCALE_PORT`), espera una línea
  numérica en 5 s, maneja los códigos de error del puerto (ocupado, no encontrado, no disponible).

### 5.2 Modelos de Datos (Prisma Schema) y relaciones

Fuente de verdad: `backend/prisma/schema.prisma`. Enumerados:

- `BarStatus`: `POR_VALIDAR → IN_STOCK → PROCESANDO → COMPLETADO → EXITED`
- `ProcessStatus`: `OPEN → CLOSED | CANCELLED`
- `PackingStatus`: `PENDING → VALIDATED`
- `ClientRole`: `PROVEEDOR | CLIENTE | AMBOS`

```
Client ─┬─< Bar           (1:N)  clientId  — proveedor/cliente del bar
        ├─< Process       (1:N)  clientId  — proveedor representativo
        ├─< Packing       (1:N)  clientId
        └─< MaterialExit  (0..N) clientId  — cliente destino opcional

Process ─< Lot           (1:N)  processId   (un proceso con UN LOTE fisico consolidado)
Lot    ─< Bar            (1:N)  lotId       (barras asignadas al lote, PROCESANDO/COMPLETADO)
Lot    >─< MaterialExit   (via ExitDetail, N:M)

MaterialExit ─< ExitDetail   (1:N)
ExitDetail    ─ Lot          (N:1)  + unique([exitId, lotId])
ExitDetail    ─< Bar         (1:N)  exitDetailId
Bar          ─ MaterialExit  (N:1)  exitId    (egreso directo de barra suelta)
Bar          ─ Packing       (N:1)  packingId (origen de la carga)
Bar          ─ Client        (N:1)
```

Campos críticos de `Bar`:

| Campo | Tipo Prisma | Significado |
|---|---|---|
| `spGrossWeight`, `spPurity` | `Decimal(15,4)` / `Decimal(7,4)` nullable | **Propuestos** (del Excel/spreadsheet) |
| `grossWeight`, `purity` | `Decimal(15,4)` / `Decimal(7,4)` | **Validados/analíticos** (los que mandan) |
| `fineWeight` (FA) | `Decimal(15,4)` | `grossWeight × purity / 1000` (redondeado a 2 dec.) |
| `leyAg`, `fineWeightAg` | `Decimal(7,4)` / `Decimal(15,4)` nullable | Plata opcional |
| `status` | `BarStatus` | Ciclo de vida |
| `lotId` | FK `Lot?` | Si está en (o fue de) un lote |

Campos críticos de `Lot`:

| Campo | Significado |
|---|---|
| `recovered` (BR) | **Peso físico recuperado de balanza** tras la fundición |
| `purity` (‰) | Ley calibrada del lote refundido |
| `fineWeight` | Peso fino calibrado (si presente, es **la unidad de inventario** del lote) |
| `photoUrl`, `recoveryAt`, `operator`, `moldCode`, `castingTemp` | Evidencia y metadata operativa |

Unicidades relevantes: `@@unique([clientId, barNumber])` (número de barra único por proveedor),
`@@unique([name, clientId])` en Process, `@@unique([exitId, lotId])` en ExitDetail, RIF único en Client.

### 5.3 Reglas de Negocio Clave

#### 5.3.1 Ley Au (Pureza): SIEMPRE en milésimas (‰), rango 0–1000

- En **todo el dominio** (backend, base de datos y cálculos de reportes) la pureza vive como
  **milésimas**: 1000 = 100% oro fino. Valores `0 < × ≤ 1000`.
- El **peso fino** se calcula siempre como:

```
FineWeight (FA) = round( grossWeight × purity/1000 × 100 ) / 100   // redondeo a 2 decimales
```

  Fórmula equivalente en backend (bars.service.ts:59): `Math.round(grossWeight * (purity / 1000) * 100) / 100`.
- **Normalización de datos antiguos:** `src/scripts/normalize-purity.ts` detecta registros que quedaron
  en **escala fracción** (`0.000001 ≤ purity ≤ 1`) y los multiplica por `1000`. Ejecutar si se integran
  datos de versiones anteriores.

#### 5.3.2 Peso Teórico (BI) vs Peso Físico (BR / recovered)

- **BI (Bruto Inicial / teórico):** el `grossWeight` original de las barras ingresadas a la bóveda.
  Es la base de la contabilidad de recepción.
- **BR (Bruto Refundido / físico):** el `lot.recovered` medido en balanza después de fundir. Es el peso
  real que queda disponible para despacho.
- **Merma = BI − BR** (positiva = pérdida de material / incertidumbre de balanza; el dashboard la
  limita con `max(0, ...)`).
- **Lote calibrado como unidad física:** cuando un lote tiene `fineWeight` (y `purity`) definidos, el
  lote se convierte en la **unidad de inventario** (los reportes de Saldos/Bóveda agrupan por lote y
  usan `lot.fineWeight` como peso fino disponible y `lot.recovered` como bruto en bóveda).
- **elegibilidad de egreso:** un lote sólo puede egresarse si su `process.status = CLOSED` y tiene
  barras disponibles; las barras sueltas egresables son las `IN_STOCK`/`COMPLETADO` sin `lotId`.

#### 5.3.3 Prorrateo de Mermas en Lotes Mixtos

El prorrateo es el corazón de la contabilidad multi-proveedor. **Cuándo aplica:** un lote contiene
barras de **2+ proveedores** (`isMixed = true`, detectado en `createFullProcess` al contar `clientId`
únicos). Al fundir, el oro no puede devolverse barra a barra físicamente; la merma (y el BR) se
distribuye **proporcionalmente al peso fino (o bruto) aportado por cada proveedor**.

Implementación (frontend `lib/prorateEgresoBR.ts`):

```
lotGrossTotal(lote)    = Σ grossWeight de barras del lote (fallback: weightAported)
lotBrTotal(lote)       = lot.recovered  (si > 0)  else lotGrossTotal(lote)
clientLotGross(lote)   = Σ grossWeight de barras cuyo clientId == proveedor
computeClientBRFromLot = lotBrTotal × grossCliente / grossTotal
computeClientEgresoBR  = Σ bruto directo (barras sueltas del proveedor)
                      + Σ computeClientBRFromLot (por cada ExitDetail)
```

La **merma por proveedor** en el reporte de Saldos se calcula como:
`Merma = BI_egresado - BR_egresado`, donde `BI_egresado = Σ grossWeight` y `BR_egresado =
computeClientEgresoBR`. En el **reporte de Egresos detallado**, el BR del lote se reparte barra a
barra proporcional a su peso bruto, dejando en la **última barra el residuo** para que las sumas
cuadren:
`pesoBalanza_barra_i = round(recovered × grossWeight_i / Σ grossWeight)` (última: `recovered − Σ previas`).

El backend replica la lógica de composición (`buildLotComposition` en processes.service.ts):
composición por proveedor = Σ `fineWeight` por cliente y su **%** sobre el total; expone
`availableWeight = lot.fineWeight (si calibrado) si_no Σ bar.fineWeight` y
`grossWeight = lot.recovered (si existe) si_no Σ bar.grossWeight`.

#### 5.3.4 Operaciones atómicas (transacciones)

Los flujos de escritura multi-entidad son **transaccionales** (`prisma.$transaction`, timeout 15 s):
crear proceso completo (barras → proceso → lote → estados), cancelar proceso (devuelve barras a
`IN_STOCK`), egresos por lotes/barras/mixtos (validaciones + `ExitDetail` + marcar `EXITED`) y la
carga masiva (packing + `createMany` + conteos). Esto garantiza consistencia del inventario.

---

## 6. Consideraciones para Migración a Escritorio

Objetivo del cliente: reutilizar la lógica actual como base para una **Desktop App**. Notas por área:

### 6.1 Manejo de descargas de archivos (PDF/Excel)

- Hoy los reportes se generan **en el navegador** y descargan `jsPDF.save()` o un **Blob →
  `URL.createObjectURL` → `<a download>`**. En **Electron** esto funciona igual (el renderer es
  Chromium). En **Tauri** hay que interceptar la descarga y escribir con `dialog.save` + `fs.write`
  (ojo: `fs` web no existe; usar plugin `fs`).
- Los **PDF del backend** (`GET /api/reports/...`) usan `Content-Disposition: attachment`; en desktop
  se preferiría no tener servidor HTTP y generar el PDF **en el proceso de fondo** (ver 6.4).

### 6.2 Almacenamiento de imágenes y archivos

- Las fotos hoy van a **Vercel Blob (privado)** y se sirven por un proxy HTTP. En desktop evaluar:
  - **Local:** guardar archivos en `app.getPath('userData')` / carpeta de la app, con rutas relativas en
    la BD (SQLite) — ventajas: sin nube, offline, datos sensibles en el dispositivo.
  - **Nube:** mantener Vercel Blob/S3 y hablar con él vía IPC desde el proceso principal (no exponer
    `BLOB_READ_WRITE_TOKEN` en el renderer).

### 6.3 Comunicación y IPC (Electron/Tauri)

- Hoy la UI habla HTTP contra un backend; en desktop la UI necesita una **capa tipo API local**:
  - **Electron:** canal IPC `ipcMain.handle` / `ipcRenderer.invoke`; el proceso **main** (Node) puede
    ejecutar la lógica de negocio (SQLite o Postgres) y el acceso serial. La UI se refactoriza de
    "llamar `api.get(...)`" a "llamar `window.api.get(...)`" (cursores contextBridge) manteniendo la
    misma forma de contrato.
  - **Tauri:** comandos Rust + `@tauri-apps/api`; la lógica de negocio debe reimplementarse en **Rust**
    o ejecutarse en un sidecar Node.
- **Báscula serial:** hoy `serialport` corre **en el backend Node**. En Electron corre en el proceso
  **main**; en Tauri hay que usar la crate `serialport` (Rust) o un **sidecar** Node. Considerar una
  abstracción `ScaleDevice` polimórfica (Nodo local / sidecar).

### 6.4 Qué lógica de backend habría que reimplementar si se migra a otro lenguaje (p. ej. C#)

| Componente Node/TS actual | Equivalente sugerido |
|---|---|
| NestJS (rutas, DI, pipes, filtros) | ASP.NET Core Web API (`Controllers`, `Program.cs`, FluentValidation) |
| `@prisma/client` + `adapter-pg` | EF Core + Npgsql / Dapper (migrar schema de Prisma a Migraciones EF o `Script-Migration`) |
| `Decimal(15,4)` / `Decimal(7,4)` | `decimal(15,4)` / `decimal(7,4)` en SQL Server/Postgres; usar `decimal` (no `float`) para pesos/leyes |
| `exceljs` (lectura/escritura xlsx) | ClosedXML / NPOI (lectura de Excel para carga masiva; NPOI) |
| `pdfkit` (reportes backend) | QuestPDF / iText 7 (reportes server-side) |
| `jsPDF` + `autoTable` + `html-to-image` | **Reescribir como reportes de escritorio** (los reportes actuales del frontend no corren en C#) |
| `serialport` | `System.IO.Ports.SerialPort` |
| `@vercel/blob` | Blob Storage de Azure / filesystem local |
| Estado asíncrono React Query | El patrón ya es UI; en desktop se conserva si la UI es webview (Electron) o se reemplaza con estado nativo |
| `localStorage` (sesión mock) | **Implementar autenticación real** (BCrypt + JWT local, o sesión OS) — hoy **no hay seguridad** |

### 6.5 Decisiones de arquitectura recomendadas para desktop

1. **Conservar el frontend actual como capa de UI** empotrada en **Electron** (máxima reutilización:
   React, Tailwind, recharts, jsPDF/ExcelJS actuales) y mover el backend NestJS a un **proceso Node
   local** (sidecar) o reimplementar la capa de datos con **Prisma/SQLite**.
2. **Swap de transporte:** aislar el cliente HTTP en un contrato (`hooks` → servicio de datos) para
   poder reemplazar Axios por **IPC** sin tocar componentes.
3. **BD local:** evaluar **Prisma + SQLite** (o Postgres embebido via Docker) — el schema actual (sin
   tipos especializados de Postgres) es migrable a SQLite casi directo; vigilar `generate_series`
   usado en `dashboard.service.ts` (SQL de Postgres → reescribir en SQLite/Rust).
4. **Cron/licencias:** el dashboard hoy hace *polling* cada 30 s; en desktop se prefiere **eventos de
   push** (IPC pub/sub) para evitar consumo.
5. **Offline:** desacoplar el almacenamiento de fotos y exportables del backend (carpeta local +
   rutas relativas).
6. **Auditoría contable:** la matemática crítica (‰, FA, BI/BR, merma, prorrateo mixto) debe quedarse
   en **una librería núcleo** (`lib/metrics`) compartida y con **tests unitarios**; es la parte que
   menos debe cambiar entre Web y Desktop.

---

## 7. Flujos de datos de extremo a extremo (más relevantes)

### 7.1 Ciclo completo de una barra

```
Registro/Excel → Bar(POR_VALIDAR, packingId) → Validación en packing → Bar(IN_STOCK, gross/purity/fine OK)
  → seleccionada en Proceso (POST /processes/full) → Bar(PROCESANDO, lotId)
  → recuperación de lote (PATCH /lots/:id recovered/purity/fineWeight)
  → cierre de proceso (PATCH /processes/:id → CLOSED) → Bar(COMPLETADO)
  → egreso (POST /material-exits) → ExitDetail(lote, weightAported) → Bar(EXITED, exitDetailId)
```

### 7.2 Egreso mixto (lotes + barras sueltas)

```
POST /material-exits { destination, clientId?, lotIds?, barIds? }
  1) Valida: procesos CLOSED con barras disponibles; barras IN_STOCK/COMPLETADO sin lote.
  2) materialExit.create(totalWeight = Σ gross).
  3) Por lote: exitDetail.create(lotId, weightAported = Σ gross del lote); barras → EXITED + exitDetailId.
  4) Barras sueltas: barras → EXITED + exitId.
  5) Devuelve el egreso completo (exitDetails + lots + bars + clients) para reporte/trazabilidad.
```

### 7.3 Reporte de Saldos (cálculo en cliente)

```
computeSaldosReport(clientes + barras + lotes + egresos + packings, desde, hasta, clienteId?)
  → por proveedor: Recibido(BI por fecha) − Egresado(BR prorrateado, por fecha de egreso) = Saldo + Merma
  → detallado: si el lote está calibrado (fineWeight != null) agrupa por lote; si no, por barra.
```

---

## 8. Glosario de términos contables

| Término | Sigla | Definición |
|---|---|---|
| **Peso Bruto Inicial** | **BI** | `grossWeight` de entrada (teórico, balanza de recepción) |
| **Peso Bruto Refundido** | **BR** | `lot.recovered` (físico, balanza post-fundición) |
| **Peso Fino** | **FA** | `fineWeight` = `BI × ley / 1000`, 2 decimales |
| **Ley Au** | — | Pureza en milésimas (‰), 0–1000 |
| **Merma** | M | `BI − BR` (por proveedor, prorrateada en mixtos) |
| **Packing** | — | Lote documental de entrada (archivo Excel) con estado PENDING/VALIDATED |
| **Proceso** | — | Evento de fundición (OPEN/CLOSED/CANCELLED); autogenera nombre `P-N` o `PROCESO MIXTO-NN` |
| **Lote** | — | Unidad física de fundición dentro de un proceso; único lote por proceso |
| **Egreso** | — | `MaterialExit` con `ExitDetail` por lote; destino + cliente opcional |

---

## 9. Comandos de desarrollo rápidos

```bash
# Instalación global (pnpm workspace)
pnpm install

# Backend (puerto 3001)
cd backend && pnpm run start:dev

# Frontend (puerto 3000)
cd frontend && pnpm run dev

# Migraciones Prisma (desde backend/)
npx prisma migrate dev     # nueva migración
npx prisma studio          # explorar datos

# Normalizar purezas antiguas (fracción → ‰)
pnpm run purity:normalize   # desde backend/
```

Variables de entorno relevantes:
- `backend/.env`: `DATABASE_URL`, `PORT`, `FRONTEND_URL`, `SCALE_PORT`, `SCALE_BAUD_RATE`.
- `frontend/.env.local`: `BACKEND_URL`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_API_URL` (opcional).
- **No hay autenticación real:** el login es mock local (cualquier usuario/contraseña); la API es de
  acceso abierto. A considerar para producción/desktop.