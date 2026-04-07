# 🏘️ RentCRM Pro — Estado del Proyecto

**Última actualización:** 07/04/2026
**Versión:** 1.5.0
**Entorno:** LXC Docker · 192.168.1.123 · Frontend :3000 · API :3001

---

## ✅ Módulos Completados

### Backend (NestJS + Prisma + PostgreSQL)
- **Auth** — JWT, guards de roles (admin / gestor / viewer), **2FA TOTP** (otplib v13, Google Authenticator / Authy, tempToken de 5 min en paso OTP)
- **Users** — CRUD completo con roles y activación/desactivación
- **Properties** — CRUD completo + campo `sesCodigoEstablecimiento`
- **Clients** — CRUD + búsqueda + tipo doc + país expedición + teléfono con prefijo
- **Bookings** — CRUD + huéspedes adicionales (BookingGuestSes) + validación documentos + estados
- **Financials** — ingresos/gastos + categorías
- **Contracts** — templates con variables, firma digital, link público, vista HTML con firmas
- **Evaluations** — ratings 1-5 por reserva, media por cliente, resumen
- **Organization** — configuración completa (logo, SMTP, moneda, fecha, NIF, **credenciales SES**)
- **iCal** — importar feeds Airbnb/Booking.com, sincronización manual y auto (cron cada 6h), exportar .ics por propiedad
- **SES Hospedajes** — envío de partes al webservice MIR, descarga XML/PDF, campos lote y estado en Booking
- **Paperless-ngx** — subida automática al firmar contrato + **webhook** para crear gastos automáticos desde facturas; correspondent por propiedad; enlace "Ver factura" en Financials
- **Inventory** — maestro de materiales (CRUD, código de barras Code128 auto-generado), stock por propiedad, movimientos entrada/salida/recuento, valoración al último precio de entrada, alertas de stock mínimo, recuento masivo, rol `inventario` con acceso exclusivo al módulo, validación stock negativo

### Frontend (React + Vite + TypeScript + Tailwind)
- **Login** — autenticación JWT + **flujo 2FA** (paso 2 con código OTP si activado)
- **Perfil** — página `/profile` con datos del usuario y sección Seguridad (activar/desactivar 2FA con QR)
- **Dashboard** — 4 pestañas: Resumen (KPIs, barras ingresos/gastos, línea ocupación, mapa de calor), Negocio (rentabilidad, ranking, tarta canales, métricas con comparativa), Clientes (top 10, nacionalidades, nuevos/repetidores), Cumplimiento (SES, checkins, contratos)
- **Properties** — CRUD completo + código SES por propiedad + **sección iCal por propiedad** (feeds, sync, export .ics)
- **Clients** — lista con valoración media + tipo doc + país con bandera + teléfono con prefijo
- **ClientDetail** — historial de reservas + ratings + resumen
- **Bookings** — lista + formulario completo + nuevo cliente inline + huéspedes adicionales SES + validación documentos (DNI/NIE/pasaporte) + teléfono con prefijo
- **BookingDetail** — cliente, propiedad, huéspedes, contrato, financiero, valoración + **sección SES** (enviar, PDF, XML, estado/lote)
- **Financials** — ingresos/gastos + KPIs + filtros
- **Contracts** — CRUD + envío + link firma + vista HTML
- **ContractTemplates** — editor + variables + firma arrendador (canvas)
- **SignContract** — página pública de firma
- **OccupancyCalendar** — vista multi-propiedad (timeline horizontal) y mensual, tema claro/oscuro
- **Settings** — 6 pestañas: Usuario, General, Fiscal, Email SMTP (con test), SES Hospedajes, Preferencias
- **UserManagement** — CRUD usuarios (admin only): crear, editar, activar/desactivar, resetear contraseña temporal
- **Inventory** — página `/inventory` con 3 pestañas: Master Data (lista materiales + códigos de barras), Stock (movimientos por propiedad, valoración), Recuento (recuento masivo). Accesible también para el rol `inventario`.
- **Profile** — sección "Cambiar contraseña" disponible para todos los roles
- **Bookings** — actualización masiva de precios vía Excel (modal con plantilla + import)

### Internacionalización (i18n)
- ✅ Traducciones ES/EN completas en TODAS las páginas
- Namespaces activos: `nav`, `common`, `dashboard`, `properties` (incluye `properties.ical`), `clients`, `bookings`, `financials`, `contracts`, `templates`, `evaluations`, `settings`, `calendar`, `users`, `inventory`, `profile`, `police`
- Idioma persistido en localStorage, cambio instantáneo desde Settings → Usuario

---

## 🔄 Pendiente

| Prioridad | Tarea |
|-----------|-------|
| 🔴 Alta | `Police.tsx` — historial de envíos SES con filtros y reenvío |
| 🔴 Alta | Email de notificación cuando SES devuelve error |
| 🟡 Media | Etiquetas de códigos de barras — página de impresión (CSS print) |
| 🟡 Media | iCal: URL export usando dominio externo `crm.greywoodhome.es` |
| 🟡 Media | iCal: mostrar tamaño de feeds en la UI |
| 🟢 Baja | SVG logo RentalSuite integrado en la app |
| 🟢 Baja | Notificaciones push (check-in próximo, contratos sin firmar, pagos pendientes) |
| 🟢 Baja | Alta en hospedajes.ses.mir.es (activar envío real de partes SES) |

---

## 🗂️ Estructura del Proyecto
```
rentcrm-pro/
├── apps/
│   ├── api/                        # NestJS backend
│   │   └── src/
│   │       ├── auth/               # JWT + guards + roles
│   │       ├── users/
│   │       ├── properties/
│   │       ├── clients/
│   │       ├── bookings/           # Incluye SesService (partes SES)
│   │       │   └── dto/            # BookingGuestSes DTO
│   │       ├── financials/
│   │       ├── contracts/          # Templates + firma digital + HTML view
│   │       ├── evaluations/        # Ratings por estancia
│   │       ├── ical/               # iCal import/export + cron sync
│   │       └── organization/       # Config + test SMTP + credenciales SES
│   └── frontend/                   # React + Vite
│       └── src/
│           ├── pages/              # 15 páginas implementadas
│           │   ├── Properties.tsx  # CRUD + iCal section por propiedad
│           │   ├── Bookings.tsx    # Huéspedes SES, validación docs
│           │   ├── BookingDetail.tsx # Sección SES: enviar, PDF, XML
│           │   ├── Settings.tsx    # 6 tabs incl. SES y Email
│           │   ├── OccupancyCalendar.tsx
│           │   └── UserManagement.tsx
│           ├── components/         # Layout + navegación
│           ├── context/            # AuthContext + UserPreferencesContext
│           ├── i18n/               # Traducciones ES/EN (index.ts)
│           └── lib/                # api.ts (axios)
├── docker-compose.yml
└── .env
```

---

## 🏗️ Arquitectura

| Capa | Tecnología | Puerto |
|------|-----------|--------|
| Frontend | React + Vite + TypeScript + Tailwind | 3000 |
| Backend | NestJS + TypeScript | 3001 |
| Base de datos | PostgreSQL + Prisma ORM | 5432 |
| i18n | i18next + react-i18next | ES / EN |
| Auth | JWT + Guards NestJS | — |
| Infra | Docker Compose en LXC | 192.168.1.123 |

---

## 📦 Modelos de Base de Datos

| Modelo | Campos destacados |
|--------|------------------|
| Organization | name, nif, logo, smtpHost/Port/User/Pass/From, currency, dateFormat, sesUsuarioWs, sesPasswordWs, sesCodigoArrendador, sesCodigoEstablecimiento, sesEndpoint |
| User | name, email, passwordHash, role (admin/gestor/owner/inventario/viewer), isActive, **otpSecret, otpEnabled, otpVerifiedAt** |
| Material | name, description, type, unit, barcode (Code128 auto), standardPrice, minStock, isActive |
| StockMovement | propertyId, materialId, type (entrada/salida/recuento), quantity, unitPrice, userId |
| Property | name, address, city, province, rooms, status, sesCodigoEstablecimiento |
| Client | firstName, lastName, docType, docNumber, docCountry, nationality, birthDate, email, phone |
| Booking | checkInDate, checkOutDate, totalAmount, source, status, sesLote, sesStatus, sesSentAt |
| BookingGuestSes | bookingId, firstName, lastName, docType, docNumber, docCountry, birthDate, phone |
| Contract | token, status, signatureImage, signerName, signedAt, depositAmount |
| ContractTemplate | name, type, content, ownerName, ownerNif, ownerSignature, clauses |
| Financial | type, amount, date, description, categoryId |
| ClientEvaluation | score (1-5), notes, bookingId (unique), clientId |
| AvailabilitySync | propertyId, platform, icalUrl, exportToken, isActive, lastSyncAt, lastSyncStatus |
| AvailabilityBlock | propertyId, syncId, externalUid, summary, startDate, endDate, source |

---

## 🔑 Variables de Entorno (.env)
```
DATABASE_URL=postgresql://rentcrm:...@postgres:5432/rentcrm
JWT_SECRET=...
FRONTEND_URL=http://192.168.1.123:3000
POSTGRES_PASSWORD=...
```
> SMTP y credenciales SES configurables desde UI en Configuración

---

## 🔑 Roles de Usuario

| Rol | Acceso |
|-----|--------|
| admin | Acceso total a toda la aplicación incluyendo gestión de usuarios |
| gestor | Acceso total excepto gestión de usuarios |
| owner | Acceso de lectura + gestión de reservas propias |
| viewer | Solo lectura en todos los módulos |
| inventario | Solo módulo `/inventory`: ver materiales, registrar movimientos, hacer recuentos. Sin acceso al resto de la app. NO puede crear ni editar materiales. |

---

## 📋 Historial de Sesiones

### Sesión 07/04/2026 — v1.5.0
- ✅ **Módulo Inventario completo** — maestro de materiales (CRUD + código de barras Code128 auto `MAT-00000001`), stock por propiedad, movimientos entrada/salida/recuento, valoración al último precio de entrada, alertas de stock mínimo, recuento masivo, rol `inventario` (acceso exclusivo al módulo), validación stock negativo (BadRequestException si quantity > stockActual), `unitPrice` en salidas calculado automáticamente
- ✅ **Actualización masiva de precios desde Excel** — `GET /api/excel/template/bookings-price` + `POST /api/excel/import/bookings-price` + modal en Bookings.tsx
- ✅ **Cambio de contraseña desde perfil** — `PUT /api/users/me/password` accesible a cualquier rol autenticado; validación de contraseña actual + mínimo 8 caracteres
- ✅ **Documentación actualizada** — INVENTORY_ARCHITECTURE.md, CLAUDE.md, TODO.md, ESTADO_PROYECTO.md

### Sesión 22/03/2026 — v1.4.0
- ✅ **Webhook Paperless-ngx → Expense automático** — `POST /api/paperless/webhook` (@Public)
  - Valida `X-Paperless-Secret` contra `Organization.paperlessSecret`
  - Filtra documentos por `document_type_name = "Factura"`
  - Busca `Property` por `paperlessCorrespondentId` (nuevo campo Int?)
  - Infiere tipo de gasto desde tags: `agua|luz|internet|limpieza|tasas` → `otros`
  - Crea `Expense` con `paperlessDocumentId`, `paperlessAmount`, y enlace preview en `notes`
  - Nuevos campos en BD: `Property.paperlessCorrespondentId`, `Expense.paperlessDocumentId`, `Expense.paperlessAmount`, `Organization.paperlessSecret`
- ✅ **Settings** — campo "Secret webhook" (password) + URL webhook readonly en pestaña Paperless
- ✅ **PropertyEdit** — campo "ID Correspondent Paperless" (número opcional)
- ✅ **Financials** — enlace "Ver factura" en gastos con `paperlessDocumentId`

### Sesión 17/03/2026 — v1.3.0
- ✅ **Autenticación 2FA con OTP (TOTP)** — compatible Google Authenticator / Authy
  - Backend: 3 campos nuevos en User (otpSecret, otpEnabled, otpVerifiedAt), endpoints `POST /users/otp/setup|verify|disable`, flujo login con tempToken de 5 min, endpoint `POST /auth/otp/validate`
  - Frontend: Login en 2 pasos cuando 2FA activo, página `/profile` con sección Seguridad (QR setup, activar/desactivar con confirmación de código), enlace al perfil desde el nombre en el sidebar

### Sesión 14/03/2026
- ✅ **Dashboard rediseñado** — 4 pestañas con recharts: Resumen (KPIs hoy, barras ingresos/gastos 12 meses, línea ocupación mensual por propiedad, mapa de calor 12×31), Negocio (rentabilidad por propiedad, ranking horizontal, tarta canales, precio medio/estancia media con comparativa año anterior), Clientes (top 10, tarta nacionalidades, nuevos vs repetidores), Cumplimiento (KPIs SES/checkin/contratos del mes, lista SES pendiente)
- ✅ **Fix Dockerfile frontend** — copia root `node_modules` además de los de workspace (igual que API); necesario tras hoisting de vite/recharts por npm workspaces
- ✅ **Documentación actualizada** — README completo, ESTADO_PROYECTO, TODO

### Sesión 08/03/2026
- ✅ **Documentación actualizada** — CLAUDE.md y ESTADO_PROYECTO.md sincronizados con estado real del proyecto

### Sesión 07/03/2026
- ✅ **UserManagement** — CRUD completo (admin only): crear, editar, roles, activar/desactivar, resetear contraseña temporal
- ✅ **iCal refactorizado** — gestión de feeds movida de página separada (`/ical`) a ficha de propiedad (modal por propiedad en Properties.tsx)
- ✅ Eliminados: ruta `/ical`, enlace menú lateral, namespace i18n `ical` → migrado a `properties.ical`

### Sesión 06/03/2026
- ✅ **Calendario de ocupación** — vista multi-propiedad (timeline horizontal) y mensual; tema claro/oscuro; barras de reservas visibles
- ✅ **Módulo SES Hospedajes completo** — credenciales en Settings, campo código por propiedad, envío webservice SOAP, descarga XML/PDF, estado lote en BookingDetail
- ✅ **Clients mejorado** — tipo documento, país expedición, nacionalidad con bandera emoji, teléfono con prefijo de país
- ✅ **Bookings mejorado** — huéspedes adicionales (BookingGuestSes), validación DNI/NIE/pasaporte (debounce 600ms), teléfono con prefijo, nuevo cliente inline
- ✅ Fix: DocFields/PhoneField definidos fuera del componente (evita pérdida de foco en re-renders)
- ✅ Fix: Properties campo status (activa/mantenimiento/inactiva)

### Sesión 05/03/2026
- ✅ **iCal** — módulo backend (ical.js, cron @nestjs/schedule), endpoints GET/POST/DELETE/sync/export
- ✅ i18n completo en todas las páginas
- ✅ Fix smtpPort como Int, test SMTP con modal de resultado visual
- ✅ Documentación técnica ES/EN generada

### Sesiones anteriores
- ✅ Backend completo: Auth, Users, Properties, Clients, Bookings, Financials, Contracts, Evaluations, Organization
- ✅ Frontend: todas las vistas principales
- ✅ Contratos: templates, firma digital arrendador, link público firma, vista HTML
- ✅ Evaluaciones: ratings 1-5, media por cliente
- ✅ Fix CORS para 192.168.1.123
