# RentCRM Pro — Estado del Proyecto

> Última actualización: 17/03/2026 — v1.3.0

## Stack
- **Frontend**: Vite + React (TypeScript), puerto 3000, Docker (rebuild obligatorio)
- **API**: NestJS, puerto 3001, prefijo `/api`
- **BD**: PostgreSQL 15, `localhost:5432`, DB `rentcrm`
- **Cache**: Redis 7, `localhost:6379`
- **Traducciones**: LibreTranslate self-hosted, puerto 5000, 10 idiomas (es/en/fr/de/it/pt/nl/da/nb/sv)
- **Documentos**: Paperless-ngx (integración opcional para contratos firmados)

## Módulos implementados
| Módulo | Estado | Descripción |
|--------|--------|-------------|
| auth | ✅ | JWT, guards globales, roles (admin/gestor/owner/viewer), **2FA TOTP** (otplib v13) |
| users | ✅ | CRUD usuarios por organización |
| organization | ✅ | Config SMTP, SES, logo, Paperless |
| clients | ✅ | CRUD + navegación ←/→ entre registros |
| properties | ✅ | CRUD + foto + country/postalCode + modales rediseñados |
| property-rules | ✅ | Reglas de la casa: editor + 10 traducciones + checkin |
| property-content | ✅ | Contenido público propiedad + documentos reordenables |
| bookings | ✅ | CRUD + workflow estados + cambio manual + checkin tokenizado |
| evaluations | ✅ | Evaluaciones de clientes por reserva |
| contracts | ✅ | Plantillas + firma digital + view público + Paperless-ngx |
| expenses | ✅ | CRUD gastos por propiedad + campo deductible |
| recurring-expenses | ✅ | Gastos recurrentes con cron diario + notificación email |
| financials | ✅ | Movimientos financieros + detalle por propiedad + reportes ROI |
| dashboard | ✅ | 4 pestañas (recharts): resumen/negocio/clientes/cumplimiento + mapa calor |
| ses | ✅ | Partes viajeros SES Ministerio (pendiente alta en hospedajes.ses.mir.es) |
| ical | ✅ | Sync Airbnb/Booking.com via iCal |
| excel | ✅ | Exportar/importar clientes, reservas, gastos, propiedades |
| translation | ✅ | LibreTranslate con caché Redis + precalentamiento |
| paperless | ✅ | Integración Paperless-ngx para contratos firmados |

## Funcionalidades UX clave
- Autenticación 2FA por usuario (activar/desactivar desde `/profile`)
- Edición masiva (bulk): reservas, clientes, gastos
- Navegación ←/→ entre registros en detalle de cliente y reserva
- Filtros y ordenación por columna en Clients, Bookings, Financials (frontend, no query params)
- Responsive móvil completo con drawer hamburguesa

## Git Workflow
- `develop` → rama de desarrollo activa
- `main` → producción (merge desde develop)
- Tags semánticos: `v1.0.0`, `v1.1.0`, `v1.2.0`, `v1.3.0`

## Pendiente crítico
- Alta en https://hospedajes.ses.mir.es (para activar envío de partes SES)
- Ver TODO.md para lista completa

## Alcance del producto
- **Caso base**: reservas **indirectas** (via OTAs: Airbnb, Booking.com, etc.)
- **Módulos que también aplican a directos**: Order Confirmation Agent, Lio Assistant
