# 🏘️ RentCRM Pro — Estado del Proyecto

**Última actualización:** 04/03/2026  
**Versión:** 1.0  
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

### Frontend (React + Vite + TypeScript + Tailwind)
- **Login** — autenticación JWT
- **Dashboard** — métricas básicas
- **Properties** — CRUD completo
- **Clients** — lista con valoración media + ficha detallada + historial
- **Bookings** — lista + detalle con navegación cruzada
- **BookingDetail** — cliente, propiedad, huéspedes, contrato, financiero, valoración
- **ClientDetail** — historial de reservas + ratings + resumen
- **Financials** — ingresos/gastos + filtros
- **Contracts** — CRUD + envío + link firma + vista HTML completa
- **ContractTemplates** — editor con variables + firma arrendador (canvas)
- **SignContract** — página pública de firma con canvas
- **Settings** — 5 pestañas: Usuario, General, Fiscal, SMTP, Preferencias
- **i18n** — traducciones ES/EN con i18next (menú lateral y Settings completos)

---

## 🔄 Pendiente Inmediato

| Prioridad | Tarea |
|-----------|-------|
| 🔴 Alta | Completar traducciones EN en todas las páginas (Clients, Bookings, BookingDetail, ClientDetail, Contracts, ContractTemplates, Financials, Dashboard, Properties) |
| 🔴 Alta | Gestión de usuarios — CRUD con roles desde panel admin |
| 🟡 Media | Calendario de ocupación por propiedad |
| 🟡 Media | Dashboard mejorado — KPIs, gráficos de ingresos, tasa de ocupación |
| 🟢 Baja | Partes SES (registro de huéspedes para SES Hospedajes España) |
| 🟢 Baja | iCal Sync (Airbnb, Booking, Vrbo) |
| 🟢 Baja | Notificaciones (check-in próximo, contratos sin firmar, pagos pendientes) |

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
│   │   │   └── organization/       # Configuración organización
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       └── seed.ts
│   └── frontend/                   # React + Vite
│       └── src/
│           ├── pages/              # 12 páginas implementadas
│           ├── components/         # Layout + navegación i18n
│           ├── context/            # AuthContext + UserPreferencesContext
│           ├── i18n/               # Traducciones ES/EN
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
| Organization | name, nif, logo, smtp*, currency, dateFormat |
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

## 📋 Sesión Anterior — Resumen de Cambios

- ✅ Valoraciones: botón disponible en cualquier momento (sin restricción de fecha)
- ✅ Valorar estancia desde detalle de reserva
- ✅ Media de valoraciones visible en lista de clientes
- ✅ Vista HTML del contrato completo con firma arrendador + arrendatario
- ✅ Firma del arrendador guardada en template (canvas HTML5)
- ✅ Fix CORS para 192.168.1.123
- ✅ Configuración de organización (5 pestañas)
- ✅ i18n ES/EN con i18next — menú lateral y Settings traducidos
- ✅ Tema dark/light (localStorage)
- ✅ Selector de idioma dropdown en Settings → Usuario
- ✅ Documentación técnica ES/EN generada y subida a docs/
