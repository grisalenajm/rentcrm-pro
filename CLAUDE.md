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
│   │       ├── expenses/              ← módulo CRUD de gastos
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
- `photo` — URL/base64 de la foto de la propiedad (opcional)
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

### Expense
- `propertyId` — FK a Property
- `date` — fecha del gasto
- `amount` — importe en euros
- `type` — tasas | agua | luz | internet | limpieza | otros
- `notes` — notas opcionales

Endpoints: GET /expenses, POST /expenses, PUT /expenses/:id, DELETE /expenses/:id, GET /expenses/summary?propertyId=X

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

## Auditoría de seguridad (completada)

### 🔴 Críticas resueltas (8/8)
- [x] SSL habilitado en SES Hospedajes y SMTP (eliminado rejectUnauthorized: false)
- [x] JWT secret sin fallback hardcodeado — error en startup si no está definido
- [x] Token iCal generado con crypto.randomBytes(32)
- [x] Redis con contraseña obligatoria
- [x] Rate limiting en login (5/min) y SES send (3/min)
- [x] IDOR gastos — filtro organizationId en todos los endpoints
- [x] IDOR evaluaciones — filtro organizationId en findByBooking y findByClient
- [x] .env en .gitignore

### 🟠 Altas resueltas (8/8)
- [x] JWT movido de localStorage a memoria React
- [x] Datos de usuario movidos de localStorage a memoria React
- [x] Rate limiting global con @nestjs/throttler
- [x] Rate limiting específico en login y SES
- [x] IDOR evaluaciones por cliente corregido
- [x] Invalidación de sesión al cambiar contraseña (passwordChangedAt)
- [x] Requisitos de complejidad de contraseña (8 chars, mayúscula, número, especial)
- [x] Validación anti-SSRF en URLs iCal externas

### 🟡 Medias resueltas (8/8)
- [x] CORS usando variable de entorno FRONTEND_URL
- [x] FRONTEND_URL sin fallback a localhost
- [x] Validación enum en tipo de gasto
- [x] RolesGuard en endpoints de escritura de gastos
- [x] Límite de body 2mb
- [x] Campo raw eliminado de respuesta SES
- [x] Helmet instalado — cabeceras de seguridad HTTP
- [x] Validación tamaño y tipo en subida de fotos

### ⚪ Bajas resueltas (6/6)
- [x] Imágenes Docker con versiones fijas
- [x] Variables de entorno movidas a .env
- [x] .env.example creado
- [x] Audit logging en SES, contratos y clientes
- [x] Logger NestJS en startup
- [x] Versionado de API añadido al backlog

## Cambios recientes

### Responsive móvil (completo)
- Layout.tsx: drawer móvil con hamburguesa, overlay y cierre automático
- Dashboard, Bookings, BookingDetail, Clients, ClientDetail, Properties: tablas → tarjetas móvil
- Financials, Contracts, ContractTemplates: overflow-x-auto + tarjetas móvil
- Todos los modales: fullscreen en móvil (rounded-t-2xl, items-end)

### Login
- Campos en blanco al cargar (sin valores por defecto)
- Checkbox "Recordar usuario": guarda email en localStorage, nunca el password

### Financials
- Vista anual con selector de año (← año →)
- Tarjetas resumen: ingresos, gastos, beneficio neto
- Tabla de ingresos por propiedad con totales
- Tabla de gastos del año con CRUD completo
- Tipos de gasto: tasas, agua, luz, internet, limpieza, otros

### Properties
- Campo photo en BD y API
- Panel de detalle rediseñado: foto pequeña + datos a la derecha
- Secciones iCal y SES en panel de detalle
- Fila completa clickeable para abrir detalle
- iCal visible también en formulario de editar
- Resumen financiero anual por propiedad con drill-down a /financials

### Checkin Online
- Endpoint público GET/POST /api/bookings/checkin/:token (sin autenticación)
- Decorador @Public() en jwt-auth.guard para rutas públicas
- Scheduler @Cron('0 9 * * *') envía enlace automáticamente 2 días antes del checkin
- Botón envío manual en BookingDetail con estado: no enviado / pendiente / completado
- Página pública /checkin/:token sin sidebar ni autenticación
- Token UUID único por reserva, se regenera en cada envío

---

## Pendiente / Próximas sesiones

- [x] Responsive móvil completo (Layout, Dashboard, Bookings, BookingDetail, Clients, ClientDetail, Properties, Financials, Contracts, ContractTemplates)
- [x] Login campos en blanco + checkbox recordar usuario
- [x] PropertyDetail: foto de propiedad + resumen financiero anual con drill-down
- [x] Financials: gastos por propiedad + totales anuales
- [ ] Página Partes SES (historial de envíos)
- [ ] Consulta estado de lote SES
- [ ] Notificación email cuando SES confirma/rechaza

- [x] CHECKIN ONLINE: Enlace tokenizado para que el cliente rellene su información de checkin

- [ ] DOCUMENTOS Y REGLAS DE LA CASA: Sección de documentos por propiedad
  - El propietario escribe el texto en español
  - La app traduce automáticamente al idioma del cliente antes de enviar (usando API de traducción)
  - Tipos de documento: reglas de la casa, información de llegada, WiFi, recomendaciones locales, otros
  - Envío por email al cliente (manual o automático junto al checkin)
  - Afecta: BD (modelo Document por propiedad), API, Frontend (sección en PropertyDetail), integración traducción automática

- [ ] AUDITORÍA DE SEGURIDAD: Revisión completa del código buscando vulnerabilidades
  - Revisar endpoints API: autenticación, autorización, validación de inputs
  - Revisar frontend: XSS, datos sensibles expuestos, tokens en localStorage
  - Revisar Docker: puertos expuestos, variables de entorno, secretos
  - Revisar Prisma: SQL injection, datos sin sanitizar
  - Generar informe con vulnerabilidades encontradas y propuesta de correcciones
  - Aplicar correcciones priorizadas por severidad (crítica > alta > media > baja)

- [ ] Versionado de API: añadir prefijo /api/v1/ a todos los endpoints para permitir evolución sin romper clientes

- [ ] DEPLOY PRODUCCIÓN: Configurar Nginx como proxy reverso
  - frontend en miapp.com → contenedor frontend
  - API en miapp.com/api → contenedor api (elimina CORS y problemas de IP)
  - VITE_API_URL debe ser relativo (/api) en producción
  - Todos los parámetros de entorno deben venir de docker-compose o .env:
    * FRONTEND_URL
    * VITE_API_URL
    * DATABASE_URL
    * JWT_SECRET / JWT_REFRESH_SECRET
    * REDIS_PASSWORD
    * SMTP configuración
  - Crear docker-compose.prod.yml separado del de desarrollo
  - Documentar proceso de deploy en CLAUDE.md

---

## Próxima sesión — Checkin Online

### Objetivo
Permitir que el cliente rellene sus datos de checkin desde un enlace seguro sin necesidad de login.

### Fase 1 — Base de datos
Añadir al modelo Booking en schema.prisma:
- checkinToken    String?   @unique
- checkinStatus   String?   // pending | completed
- checkinSentAt   DateTime?
- checkinDoneAt   DateTime?

### Fase 2 — API
Nuevos endpoints:
- POST /bookings/:id/checkin/send → genera token UUID, guarda en BD, envía email al cliente
- GET  /checkin/:token → endpoint PÚBLICO (sin JWT) → devuelve datos de la reserva para mostrar el formulario
- POST /checkin/:token → endpoint PÚBLICO → recibe datos del huésped y actualiza la reserva

El email debe enviarse automáticamente 2 días antes del checkin (scheduler NestJS @Cron).
También debe poder enviarse manualmente desde BookingDetail.

### Fase 3 — Frontend público
Nueva página: src/pages/CheckinPage.tsx
- Ruta pública: /checkin/:token (añadir en App.tsx fuera del Layout autenticado)
- Sin navbar ni sidebar
- Formulario con datos del huésped: nombre, apellidos, documento, país, teléfono
- Branding mínimo: logo RentCRM Pro + nombre de la propiedad
- Al enviar: mensaje de confirmación "¡Checkin completado!"
- Si el token es inválido o ya usado: mensaje de error

### Fase 4 — BookingDetail
- Añadir botón "Enviar checkin" en la ficha de reserva
- Mostrar estado: pendiente / completado + fecha
- Si completado: mostrar fecha y hora de cuando el cliente lo rellenó

### Archivos a modificar/crear
1. apps/api/prisma/schema.prisma — nuevos campos Booking
2. apps/api/src/bookings/bookings.service.ts — lógica token + scheduler
3. apps/api/src/bookings/bookings.controller.ts — nuevos endpoints
4. apps/frontend/src/pages/CheckinPage.tsx — página pública nueva
5. apps/frontend/src/App.tsx — ruta pública /checkin/:token
6. apps/frontend/src/pages/BookingDetail.tsx — botón + estado checkin

No toques nada más.

