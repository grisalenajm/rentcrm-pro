# 🏘️ RentCRM Pro — Estado del Proyecto

**Última actualización:** 08/03/2026
**Versión:** 1.5
**Entorno:** LXC Docker · 192.168.1.123 · Frontend :3000 · API :3001

---

## ✅ Módulos Completados

### Backend (NestJS + Prisma + PostgreSQL)
- **Auth** — JWT, guards de roles (admin / gestor / viewer)
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

### Frontend (React + Vite + TypeScript + Tailwind)
- **Login** — autenticación JWT
- **Dashboard** — métricas reales (propiedades, clientes, reservas, ingresos) + reservas recientes
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

### Internacionalización (i18n)
- ✅ Traducciones ES/EN completas en TODAS las páginas
- Namespaces activos: `nav`, `common`, `dashboard`, `properties` (incluye `properties.ical`), `clients`, `bookings`, `financials`, `contracts`, `templates`, `evaluations`, `settings`, `calendar`, `users`
- Idioma persistido en localStorage, cambio instantáneo desde Settings → Usuario

---

## 🔄 Pendiente

| Prioridad | Tarea |
|-----------|-------|
| 🔴 Alta | Consulta de estado de lote SES (verificación asíncrona del Ministerio) |
| 🟡 Media | Página "Partes SES" — historial de envíos con estado y filtros |
| 🟡 Media | Notificación por email cuando SES confirma/rechaza un parte |
| 🟡 Media | Dashboard mejorado — gráficos de ingresos y tasa de ocupación |
| 🟢 Baja | Tests de envío con entorno de pruebas SES |
| 🟢 Baja | Notificaciones push (check-in próximo, contratos sin firmar, pagos pendientes) |

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
| User | name, email, passwordHash, role (admin/gestor/viewer), isActive |
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

## 📋 Historial de Sesiones

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
