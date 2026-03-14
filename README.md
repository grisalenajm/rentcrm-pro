# RentCRM Pro

CRM para gestión de alquileres vacacionales con integración SES Hospedajes (Ministerio del Interior).

## Stack

| Capa | Tecnología | Puerto |
|------|-----------|--------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS | 3000 |
| Backend | NestJS + TypeScript + Prisma ORM | 3001 |
| Base de datos | PostgreSQL 15 | 5432 |
| Caché | Redis 7 | 6379 |
| Traducciones | LibreTranslate (self-hosted, 10 idiomas) | 5000 |
| Gráficos | Recharts | — |
| i18n | i18next + react-i18next (ES / EN) | — |
| Auth | JWT + Guards de roles NestJS | — |
| Infra | Docker Compose en LXC | 192.168.1.123 |

## Funcionalidades

### Dashboard (4 pestañas)
- **Resumen** — KPIs en tiempo real (ocupación hoy, ingresos del mes, reservas activas, checkins pendientes hoy). Gráfico de barras ingresos/gastos últimos 12 meses. Línea de ocupación mensual con selector de propiedad. Mapa de calor 12×31 de días ocupados.
- **Negocio** — Rentabilidad por propiedad (ingresos, gastos, beneficio neto, ROI%). Ranking horizontal por ingresos. Tarta de origen de reservas. Métricas por periodo (mes/trimestre/año) con comparativa año anterior.
- **Clientes** — Top 10 clientes por gasto total, tarta de nacionalidades (top 8 + otros), % nuevos vs repetidores.
- **Cumplimiento** — KPIs SES del mes (enviados/error/pendientes), lista reservas con SES pendiente, progreso de checkins y contratos del mes.

### Propiedades
CRUD completo · código SES por propiedad · foto · feeds iCal (importar Airbnb/Booking.com, cron cada 6h, exportar .ics)

### Clientes
CRUD · búsqueda · tipo documento · nacionalidad con bandera · teléfono con prefijo de país

### Reservas
CRUD · workflow de estados (created → registered → processed/error/cancelled) · huéspedes adicionales SES · validación DNI/NIE/pasaporte · crear cliente inline · welcome package

### Financiero
Ingresos y gastos por propiedad · categorías · totales anuales · exportar Excel

### Contratos
Templates con variables · firma digital del arrendador (canvas) · link público de firma · estado firmado/pendiente

### Checkin online
Enlace tokenizado enviado al cliente · página pública multiidioma con reglas de la casa · un solo uso

### Reglas de la casa
Editor por propiedad · traducción automática a 10 idiomas · no sobreescribe idiomas editados manualmente

### Partes SES
Envío al webservice del Ministerio (SOAP) · descarga XML/PDF · estado y número de lote en la reserva

### Usuarios
CRUD (admin only) · roles: admin / gestor / owner / viewer · resetear contraseña temporal

### Configuración
6 pestañas: Usuario · General · Fiscal · Email SMTP (test de conexión) · SES Hospedajes · Preferencias

### Calendario de ocupación
Vista multi-propiedad (timeline horizontal) y mensual · tema claro/oscuro

## Arrancar en local (desarrollo)

```bash
# 1. Clonar y configurar
git clone git@github.com:grisalenajm/rentcrm-pro.git
cd rentcrm-pro
cp .env.example .env          # editar DATABASE_URL, JWT_SECRET, etc.

# 2. Levantar infraestructura
docker compose up -d postgres redis libretranslate

# 3. Instalar dependencias
npm install

# 4. Migrar base de datos
cd apps/api
DATABASE_URL="postgresql://rentcrm:PASS@localhost:5432/rentcrm" npx prisma migrate dev
cd ../..

# 5. API (terminal 1)
npm run dev --workspace=apps/api

# 6. Frontend (terminal 2)
npm run dev --workspace=apps/frontend
```

## Despliegue con Docker

```bash
# Primera vez o tras cambios en dependencias
docker compose build && docker compose up -d

# Solo API
npm run build --workspace=apps/api
docker compose build api && docker compose up -d api
docker logs rentcrm-api --tail=20

# Solo Frontend
docker compose build frontend && docker compose up -d frontend
docker logs rentcrm-frontend --tail=5
```

> **Nota:** el frontend usa Vite dev server dentro de Docker. Siempre requiere rebuild — no hay hot reload en el contenedor.

## Migraciones Prisma

```bash
# Siempre desde el host, nunca desde dentro del contenedor
cd apps/api
DATABASE_URL="postgresql://rentcrm:PASS@localhost:5432/rentcrm" npx prisma migrate dev --name nombre
# Si falla "migration modified":
DATABASE_URL="postgresql://rentcrm:PASS@localhost:5432/rentcrm" npx prisma db push
```

## Variables de entorno

Ver `.env.example` para la lista completa. Variables mínimas:

```
DATABASE_URL=postgresql://rentcrm:PASS@postgres:5432/rentcrm
REDIS_URL=redis://:PASS@redis:6379
JWT_SECRET=...
FRONTEND_URL=http://192.168.1.123:3000
LIBRETRANSLATE_URL=http://libretranslate:5000
```

SMTP y credenciales SES se configuran desde la UI en **Configuración**.

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| `admin` | Todo |
| `gestor` | Crear/editar reservas, clientes, propiedades, contratos, SES, checkin |
| `owner` | Solo gastos propios |
| `viewer` | Solo lectura (GET) |

## Estructura de archivos clave

```
rentcrm-pro/
├── apps/
│   ├── api/src/
│   │   ├── auth/               ← JWT + guards + @Public()
│   │   ├── bookings/           ← CRUD + SesService + CheckinService
│   │   ├── contracts/          ← templates + firma digital
│   │   ├── expenses/
│   │   ├── excel/              ← exportar/importar .xlsx
│   │   ├── financials/
│   │   ├── ical/               ← feeds iCal + cron sync
│   │   ├── organization/       ← config SMTP, SES, logo
│   │   ├── property-rules/     ← reglas de la casa + traducción
│   │   ├── translation/        ← LibreTranslate, caché
│   │   └── users/
│   └── frontend/src/
│       ├── pages/
│       │   ├── Dashboard.tsx   ← 4 pestañas con recharts
│       │   ├── BookingDetail.tsx
│       │   ├── Properties.tsx  ← iCal por propiedad
│       │   ├── Police.tsx      ← partes SES
│       │   ├── Settings.tsx    ← 6 tabs
│       │   └── CheckinPage.tsx ← página pública /checkin/:token
│       ├── i18n/index.ts       ← TODAS las traducciones (no JSON)
│       ├── data/countries.ts   ← 195 países ISO 3166-1
│       └── lib/api.ts          ← axios con baseURL '/api'
├── CLAUDE.md                   ← guía técnica para desarrolladores e IA
├── API_ENDPOINTS.md            ← referencia completa de endpoints
├── ESTADO_PROYECTO.md          ← historial de sesiones y estado
└── TODO.md                     ← tareas pendientes
```

## SES Hospedajes

Endpoint: `https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion`

> ⚠️ Estado (14/03/2026): endpoint correcto, cuenta pendiente de activar en el Ministerio. Pendiente alta en https://hospedajes.ses.mir.es

## Documentación adicional

- [`CLAUDE.md`](CLAUDE.md) — guía técnica completa (patrones, modelos, comandos)
- [`API_ENDPOINTS.md`](API_ENDPOINTS.md) — referencia de todos los endpoints
- [`ESTADO_PROYECTO.md`](ESTADO_PROYECTO.md) — historial de sesiones y estado detallado
- [`TODO.md`](TODO.md) — tareas pendientes priorizadas
