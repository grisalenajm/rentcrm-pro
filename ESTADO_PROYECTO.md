# 🏘️ RentCRM Pro — Estado del Proyecto

**Última actualización:** 05/03/2026  
**Versión:** 1.1  
**Entorno:** LXC Docker · 192.168.1.123 · Frontend :3000 · API :3001

---

## ✅ Módulos Completados

### Backend (NestJS + Prisma + PostgreSQL)
- **Auth** — JWT, guards de roles (admin / gestor / viewer)
- **Users** — CRUD básico
- **Properties** — CRUD completo
- **Clients** — CRUD + búsqueda
- **Bookings** — CRUD + huéspedes + estados
- **Financials** — ingresos/gastos + categorías
- **Contracts** — templates con variables, firma digital, link público, vista HTML con firmas
- **Evaluations** — ratings 1-5 por reserva, media por cliente, resumen
- **Organization** — configuración completa (logo, SMTP, moneda, fecha, NIF)
  - ✅ Fix: smtpPort guardado como Int (era String → error Prisma)
  - ✅ Endpoint POST `/api/organization/test-smtp` — envía email de prueba

### Frontend (React + Vite + TypeScript + Tailwind)
- **Login** — autenticación JWT
- **Dashboard** — métricas reales (propiedades, clientes, reservas, ingresos) + reservas recientes
- **Properties** — CRUD completo · ✅ i18n ES/EN
- **Clients** — lista con valoración media + ficha detallada · ✅ i18n ES/EN
- **Bookings** — lista + detalle completo · ✅ i18n ES/EN
- **BookingDetail** — cliente, propiedad, huéspedes, contrato, financiero, valoración · ✅ i18n ES/EN
- **ClientDetail** — historial de reservas + ratings + resumen · ✅ i18n ES/EN
- **Financials** — ingresos/gastos + KPIs + filtros · ✅ i18n ES/EN
- **Contracts** — CRUD + envío + link firma + vista HTML · ✅ i18n ES/EN
- **ContractTemplates** — editor + variables + firma arrendador (canvas) · ✅ i18n ES/EN
- **SignContract** — página pública de firma
- **Settings** — 5 pestañas completas · ✅ i18n ES/EN
  - ✅ Test de email SMTP con modal de resultado (✅ ok / ❌ error)

### Internacionalización (i18n)
- ✅ Traducciones ES/EN completas en TODAS las páginas
- Namespaces: nav, common, dashboard, properties, clients, bookings, financials, contracts, templates, evaluations, settings
- Idioma persistido en localStorage, cambio instantáneo desde Settings → Usuario

---

## 🔄 Pendiente Inmediato

| Prioridad | Tarea |
|-----------|-------|
| 🔴 Alta | Integración iCal — importar reservas desde Airbnb y Booking.com |
| 🔴 Alta | Gestión de usuarios — CRUD con roles desde panel admin |
| 🟡 Media | Calendario de ocupación por propiedad |
| 🟡 Media | Dashboard mejorado — gráficos de ingresos, tasa de ocupación |
| 🟢 Baja | Partes SES (registro de huéspedes para SES Hospedajes España) |
| 🟢 Baja | Notificaciones (check-in próximo, contratos sin firmar, pagos pendientes) |

---

## 📋 Plan iCal (próxima sesión)

### Alcance acordado
- Importar reservas desde **Airbnb** y **Booking.com** vía iCal
- Sincronización automática cada **6 horas** (cron job)
- Al importar: crear booking con `totalAmount=0`, pedir precio en **modal de confirmación**
- Exportar iCal de RentCRM por propiedad

### Modelo de datos a crear
```prisma
model ICalFeed {
  id          String   @id @default(uuid())
  propertyId  String
  url         String
  platform    String   // airbnb | booking | other
  lastSync    DateTime?
  createdAt   DateTime @default(now())
  property    Property @relation(fields: [propertyId], references: [id])
}
```

### Endpoints a implementar
- GET  `/ical/feeds`                  — listar feeds
- POST `/ical/feeds`                  — añadir feed
- DELETE `/ical/feeds/:id`            — eliminar feed
- POST `/ical/feeds/:id/sync`         — sincronizar manualmente
- GET  `/ical/export/:propertyId`     — exportar iCal de RentCRM

### Dependencias a instalar
```bash
npm install ical.js @nestjs/schedule
```

---

## 🗂️ Estructura del Proyecto
```
rentcrm-pro/
├── apps/
│   ├── api/                        # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/               # JWT + guards + roles
│   │   │   ├── users/
│   │   │   ├── properties/
│   │   │   ├── clients/
│   │   │   ├── bookings/
│   │   │   ├── financials/
│   │   │   ├── contracts/          # Templates + firma digital + HTML view
│   │   │   ├── evaluations/        # Ratings por estancia
│   │   │   └── organization/       # Config + test SMTP
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       └── seed.ts
│   └── frontend/                   # React + Vite
│       └── src/
│           ├── pages/              # 13 páginas implementadas
│           ├── components/         # Layout + navegación i18n
│           ├── context/            # AuthContext + UserPreferencesContext
│           ├── i18n/               # Traducciones ES/EN (index.ts)
│           └── lib/                # api.ts (axios)
├── docs/
│   ├── RentCRM_Pro_Documentacion_ES.docx
│   └── RentCRM_Pro_Documentation_EN.docx
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
| Organization | name, nif, logo, smtpHost, smtpPort (Int), smtpUser, smtpPass, smtpFrom, currency, dateFormat |
| User | name, email, passwordHash, role, isActive |
| Property | name, address, city, province, rooms, isActive |
| Client | firstName, lastName, dniPassport, nationality, birthDate, email, phone |
| Booking | checkIn, checkOut, totalAmount, source, status |
| Contract | token, status, signatureImage, signerName, signedAt, depositAmount |
| ContractTemplate | name, type, content, ownerName, ownerNif, ownerSignature, clauses |
| Financial | type, amount, date, description, categoryId |
| ClientEvaluation | score (1-5), notes, bookingId (unique), clientId |

---

## 🔑 Variables de Entorno (.env)
```
DATABASE_URL=postgresql://rentcrm:...@postgres:5432/rentcrm
JWT_SECRET=...
FRONTEND_URL=http://192.168.1.123:3000
POSTGRES_PASSWORD=...
```
> SMTP configurable también desde UI en Configuración → Email SMTP

---

## 📋 Historial de Sesiones

### Sesión 05/03/2026
- ✅ i18n completo en todas las páginas (Properties, Clients, Bookings, BookingDetail, ClientDetail, Financials, Contracts, ContractTemplates, Dashboard)
- ✅ Fix i18n: reescritura completa de ClientDetail, BookingDetail, ContractTemplates, Financials para evitar errores de sintaxis por sed/python replace
- ✅ Fix smtpPort: conversión a Int en organization.service.ts
- ✅ Test SMTP: endpoint + UI en Settings con resultado visual
- ✅ Documentación técnica ES/EN actualizada en docs/

### Sesión 04/03/2026
- ✅ Configuración de organización (5 pestañas)
- ✅ i18n ES/EN con i18next — menú lateral y Settings
- ✅ Tema dark/light + selector de idioma
- ✅ Documentación técnica generada (ES + EN)

### Sesiones anteriores
- ✅ Backend completo: Auth, Users, Properties, Clients, Bookings, Financials, Contracts, Evaluations, Organization
- ✅ Frontend: todas las vistas principales
- ✅ Contratos: templates, firma digital arrendador, link público firma, vista HTML
- ✅ Evaluaciones: ratings 1-5, media por cliente, desde reserva y ficha cliente
- ✅ Fix CORS para 192.168.1.123
