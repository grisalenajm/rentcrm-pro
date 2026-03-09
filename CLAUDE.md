# RentCRM Pro — Guía para Claude

## Stack técnico
- **Frontend**: React + TypeScript + Vite + TailwindCSS + React Query + i18next
- **Backend**: NestJS + TypeScript + Prisma ORM
- **DB**: PostgreSQL
- **Infraestructura**: Docker Compose

## Acceso y comandos clave

### Base de datos
```bash
DATABASE_URL="postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm"

# Migración
cd ~/rentcrm-pro/apps/api
DATABASE_URL="postgresql://..." npx prisma migrate dev --name nombre_migracion

# Regenerar cliente Prisma
DATABASE_URL="postgresql://..." npx prisma generate
```

### Build y deploy
```bash
# Build API
cd ~/rentcrm-pro && npm run build --workspace=apps/api

# IMPORTANTE: el contenedor Docker usa su propia imagen
# Después de cada build hay que reconstruir la imagen:
docker compose build api && docker compose up -d api

# NO usar docker compose restart api sin rebuild — usa el dist antiguo
# Copiar dist al contenedor (alternativa más rápida al rebuild):
docker cp ~/rentcrm-pro/apps/api/dist/src rentcrm-api:/app/dist/src
docker compose restart api

# Ver logs
docker compose logs api --tail=30
```

### Git
```bash
cd ~/rentcrm-pro && git add -A && git commit -m "mensaje" && git push origin main
```

---

## Estructura de archivos
```
rentcrm-pro/
├── docker-compose.yml
├── CLAUDE.md                          ← este archivo
├── apps/
│   ├── api/                           ← Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma          ← modelos de DB
│   │   │   └── migrations/            ← historial de migraciones
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── prisma.service.ts
│   │       ├── auth/                  ← JWT, guards, roles
│   │       ├── bookings/
│   │       │   ├── bookings.module.ts
│   │       │   ├── bookings.controller.ts  ← endpoints REST
│   │       │   ├── bookings.service.ts
│   │       │   ├── ses.service.ts     ← ⭐ módulo SES Hospedajes
│   │       │   └── dto/
│   │       │       ├── create-booking.dto.ts
│   │       │       ├── update-booking.dto.ts
│   │       │       └── booking-guest-ses.dto.ts
│   │       ├── clients/
│   │       │   ├── clients.controller.ts
│   │       │   ├── clients.service.ts
│   │       │   └── dto/
│   │       ├── properties/
│   │       │   ├── properties.controller.ts
│   │       │   ├── properties.service.ts
│   │       │   └── dto/
│   │       │       ├── create-property.dto.ts  ← incluye sesCodigoEstablecimiento
│   │       │       └── update-property.dto.ts
│   │       ├── organization/
│   │       │   ├── organization.controller.ts
│   │       │   └── organization.service.ts    ← incluye campos SES y SMTP
│   │       ├── contracts/
│   │       ├── evaluations/
│   │       ├── financials/
│   │       ├── ical/
│   │       └── users/
│   └── frontend/                      ← Frontend React
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── lib/
│           │   └── api.ts             ← axios instance
│           ├── context/
│           │   └── UserPreferencesContext.tsx
│           ├── i18n/
│           │   └── index.ts           ← traducciones ES/EN (objeto inline)
│           └── pages/
│               ├── Login.tsx
│               ├── Dashboard.tsx
│               ├── Properties.tsx     ← incluye campo SES por propiedad
│               ├── Clients.tsx        ← tipo doc, país, teléfono con prefijo
│               ├── ClientDetail.tsx
│               ├── Bookings.tsx       ← huéspedes SES, validación docs, banderas
│               ├── BookingDetail.tsx  ← sección SES: enviar, PDF, XML, estado
│               ├── Financials.tsx
│               ├── Contracts.tsx
│               ├── ContractTemplates.tsx
│               ├── Settings.tsx       ← tabs: Usuario, General, Fiscal, Email, SES, Preferencias
│               ├── OccupancyCalendar.tsx
│               ├── ICalFeeds.tsx
│               ├── SignContract.tsx
│               └── ComingSoon.tsx
```

---

## Modelos de base de datos relevantes

### Organization
Campos SES añadidos:
- `sesUsuarioWs` — usuario WS (NIF+WS)
- `sesPasswordWs` — contraseña WS
- `sesCodigoArrendador` — código arrendador SES
- `sesCodigoEstablecimiento` — código establecimiento por defecto
- `sesEndpoint` — URL endpoint (producción o pruebas)

### Property
- `sesCodigoEstablecimiento` — código SES específico de esta propiedad (sobreescribe el de Organization)

### Booking
- `sesLote` — número de lote devuelto por SES tras envío
- `sesStatus` — 'enviado' | 'error' | null
- `sesSentAt` — fecha/hora del último envío

### BookingGuestSes
Tabla para huéspedes adicionales por reserva:
- `bookingId`, `firstName`, `lastName`
- `docType` (dni/passport/nie/other)
- `docNumber`, `docCountry` (ISO 2 letras)
- `birthDate` (opcional), `phone` (opcional)

---

## Módulo SES Hospedajes

### Endpoints API
```
POST /bookings/:id/ses/send    → Enviar parte al webservice SES
GET  /bookings/:id/ses/xml     → Descargar XML del parte
GET  /bookings/:id/ses/pdf     → Descargar PDF del parte
```

### Flujo de envío
1. `SesService.buildXml()` — genera XML según spec v3.1.2 del Ministerio del Interior
2. Comprime con DEFLATE (zlib.deflateRaw)
3. Codifica en Base64
4. Envía por SOAP/HTTP Basic Auth al endpoint SES
5. Parsea respuesta: `<codigo>0</codigo>` = OK, guarda lote
6. Actualiza `booking.sesStatus` y `booking.sesLote`

### Credenciales SES
Se configuran en **Settings → SES Hospedajes**:
- Usuario WS: NIF/CIF terminado en "WS" (ej: 12345678AWS)
- Contraseña WS
- Código arrendador (asignado al registrarse)
- Código establecimiento (por defecto, se puede sobreescribir por propiedad)
- Entorno: dropdown Producción / Pruebas

### Especificación técnica
- Documento: MIR-HOSPE-DSI-WS-Servicio-de-Hospedajes-Comunicaciones-v3.1.2
- Endpoint producción: `https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion`
- Endpoint pruebas: `https://hospedajes.pre-ses.mir.es/hospedajes-web/ws/v1/comunicacion`
- Autenticación: HTTP Basic (usuario:contraseña en Base64)
- Operación: `comunicacion` (SOAP)
- Tipo comunicación: `PV` (parte de viajeros)
- XML comprimido ZIP y codificado Base64

---

## Sistema de traducciones (i18n)

Archivo: `apps/frontend/src/i18n/index.ts`
- Objeto inline con `es` y `en`
- **NO hay archivos JSON externos**
- Para añadir traducciones: editar directamente el objeto en ese archivo
- Claves importantes:
  - `bookings.statuses.pending/confirmed/cancelled/completed`
  - `bookings.sources.direct/airbnb/booking/vrbo/manual_block`
  - `common.confirm_delete`

---

## Países (COUNTRIES array)

Definido en `Bookings.tsx` y `Clients.tsx` (duplicado en ambos):
```typescript
{ code: 'ES', name: 'España', phone: '+34', flag: '🇪🇸' }
```
34 países con: código ISO-2, nombre en español, prefijo telefónico, emoji bandera.

Validación de documentos por país: función `validateDoc(docType, docNumber, country)`
- DNI España: 8 dígitos + letra con validación mod 23
- Pasaportes: UK, DE, FR, US con regex específicos
- NIE España: X/Y/Z + 7 dígitos + letra
- Debounce de 600ms en inputs

---

## Problemas conocidos resueltos

### Re-renders en formularios
Los componentes `DocFields` y `PhoneField` deben estar **fuera** del componente principal.
Si se definen dentro, React los trata como nuevos en cada render y los inputs pierden el foco.

### Migración Prisma desde host
El contenedor API no tiene acceso a internet para descargar schema-engine.
**Siempre migrar desde el host:**
```bash
cd ~/rentcrm-pro/apps/api
DATABASE_URL="postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm" \
  npx prisma migrate dev --name nombre
```

### Docker rebuild obligatorio
Después de cambios en el backend, el `docker compose restart` NO recarga el código.
Hay que hacer `docker compose build api && docker compose up -d api`.

### pdfkit con TypeScript
Usar `import PDFDocument = require('pdfkit')` en lugar de `import * as PDFDocument from 'pdfkit'`.

### Response de Express con isolatedModules
Usar `import type { Response } from 'express'` en controllers NestJS.

### notes en CreateBookingDto
El campo `notes` no existe en el DTO de booking — no incluirlo en el payload del frontend.

---

## Pendiente / Próximas sesiones

- [ ] Consulta de estado de lote SES (verificar confirmación asíncrona del Ministerio)
- [ ] Página Partes SES (nav: "Partes SES") — historial de envíos
- [ ] Notificación por email cuando el SES confirma/rechaza un parte
- [ ] Tests de envío con entorno de pruebas SES

---

## Tarea pendiente: Responsive móvil

### Objetivo
Adaptar toda la app para uso completo en móvil (crear, editar, ver).

### Archivos a modificar
1. `src/components/Layout.tsx` — menú hamburguesa + drawer con overlay
2. `src/pages/Dashboard.tsx` — tabla → tarjetas, grid responsive
3. `src/pages/Bookings.tsx` — tabla → tarjetas móvil, modal fullscreen
4. `src/pages/BookingDetail.tsx` — layout columnas → apilado, modal fullscreen
5. `src/pages/Clients.tsx` — tabla → tarjetas móvil, modal fullscreen
6. `src/pages/ClientDetail.tsx` — tabla reservas → tarjetas, modales fullscreen
7. `src/pages/Properties.tsx` — tabla → tarjetas móvil

### Patrón a aplicar en tablas → tarjetas móvil
```jsx
{/* Desktop: tabla */}
<div className="hidden md:block">
  <table>...</table>
</div>
{/* Móvil: tarjetas */}
<div className="md:hidden space-y-3">
  {items.map(item => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">...</div>
  ))}
</div>
```

### Patrón modales fullscreen en móvil
```jsx
<div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
  <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl 
                  w-full md:max-w-lg max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
```

### Patrón menú drawer móvil (Layout.tsx)
- Añadir estado `menuOpen` 
- Botón hamburguesa en header móvil (≡)
- Sidebar: `fixed inset-y-0 left-0 z-50 w-64 transform transition-transform`
  - Cerrado: `-translate-x-full`
  - Abierto: `translate-x-0`
- Overlay: `fixed inset-0 bg-black/50 z-40` visible cuando menuOpen
- Cerrar al hacer click en un enlace

### Breakpoints Tailwind usados
- `md:` = 768px → desktop
- Sin prefijo = móvil primero

### Grids responsive
```jsx
// Cards métricas Dashboard
className="grid grid-cols-2 md:grid-cols-4 gap-4"

// Formularios 2 columnas
className="grid grid-cols-1 md:grid-cols-2 gap-4"
```

### Modales con tablas internas
Las tablas dentro de modales (ej: seleccionar cliente en nueva reserva)
también necesitan scroll horizontal: `overflow-x-auto`

### Estado actual del Layout
- Sidebar fijo izquierda en desktop
- Sin adaptación móvil actual
- Ver Layout.tsx para estructura exacta antes de modificar
