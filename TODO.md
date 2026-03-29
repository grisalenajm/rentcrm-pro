# RentalSuite — Tareas pendientes
> Actualizado 27/03/2026

## En progreso
(ninguna)

### Sesión 27/03/2026
- [x] Idle timeout reducido de 30 a 15 minutos (AuthContext.tsx `IDLE_TIMEOUT_MS`) (27/03/2026)

### Sesión 25-26/03/2026
- [x] Pagos de reserva: modelo BookingPayment, endpoints CRUD, sección en BookingDetail (25/03/2026)
- [x] iCal: detectar bloques de calendario y excluir de dashboards y financials (25/03/2026)
- [x] Campos bancarios en Organization (bankSwift, bankIban, bankBeneficiary) (25/03/2026)
- [x] Referencia catastral en Property (cadastralRef) para contratos (25/03/2026)
- [x] Logs del sistema: iCal sync, SES y Paperless trackeados en Redis (26/03/2026)
- [x] Fix PATCH /bookings/:id para actualizaciones parciales (26/03/2026)
- [x] Fix source iCal: Airbnb/Booking.com siempre usan source de plataforma (26/03/2026)
- [x] Fix: manual_block excluido del listado de reservas (26/03/2026)
- [x] Fix: reservas canceladas excluidas de dashboards, financials y heatmap (26/03/2026)

## Pendiente (priorizado)

### SES Hospedajes — Frontend
- [ ] `Police.tsx`: historial de envíos SES con filtros y opción de reenvío (actualmente es placeholder ComingSoon)
- [ ] Email de notificación cuando SES devuelve error


### Gestión documental — Integración Paperless-ngx
- [x] Al subir contrato: pasar `correspondent_id` según `property.paperlessCorrespondentId` (23/03/2026)
- [x] Settings: añadir campo Document Type ID de Paperless (23/03/2026)

### Pagos de reserva
- [x] Sección "Pagos" en BookingDetail con botón "+" para añadir conceptos (25/03/2026)
- [x] Conceptos predefinidos: Fianza, Pago reserva, Pago final, Devolución fianza (25/03/2026)
- [x] Cada pago: concepto, importe, fecha (presente o futura) (25/03/2026)
- [x] Devolución fianza: importe negativo automático (25/03/2026)
- [x] Total pagado vs total reserva visible en la sección (25/03/2026)
- [x] Nuevo modelo BookingPayment en schema.prisma (25/03/2026)
- [x] CRUD: GET/POST/DELETE /api/bookings/:bookingId/payments (25/03/2026)

### Edición masiva
- [ ] Mass update precios de reservas desde Excel (por ID reserva o por propiedad + fecha entrada)

### Cambio contraseña usuario no admin
- [ ] Usuario no admin puede cambiar su contraseña desde su perfil

### Branding
- [ ] Integrar SVG logo de RentalSuite en la app (pendiente exportar los SVGs)

### Deploy producción
- [x] `docker-compose.prod.yml` limpio (17/03/2026)
- [x] `.env.example` con todas las variables documentadas (17/03/2026)
- [x] `README.md` bilingüe (EN/ES) profesional para GitHub (17/03/2026)
- [x] `setup.sh` script de instalación desde cero con Node 20, frontend .env, prisma db push/seed (29/03/2026)
- [x] `update.sh` script de actualización en producción (29/03/2026)
- [x] `CONTRIBUTING.md` (17/03/2026)
- [x] DATABASE_URL y REDIS_URL construidos internamente en docker-compose — no duplicar en .env (29/03/2026)
- [x] apps/frontend/.env.example documentado en README y copiado automáticamente por setup.sh (29/03/2026)
- [x] prisma db push antes de migrate deploy en instalación nueva (29/03/2026)
- [x] Node 20 via nodesource documentado en README y setup.sh (29/03/2026)

## Completado

### Sesión 18/03/2026
- [x] Fix login: 401 en credenciales incorrectas no dispara logout
- [x] Notas inline editables en detalle de Propiedad, Reserva y Cliente
- [x] Campo NRUA en Property (46 chars, ej: ESFCTU00000303700029732800000000000000000VT-510015-A3)
- [x] Exportación CSV N2 por propiedad seleccionada y año
- [x] CSV NRUA / VAU — Nueva funcionalidad para Depósito de Arrendamientos Comunidad Valenciana

### Sesión 17/03/2026
- [x] Fix Dashboard: ingresos = bookings.totalAmount + financials income sumados
- [x] Fix Dashboard: KPIs del periodo actual encima del selector de gráfico
- [x] ROI calculado como (beneficio anual / purchasePrice) * 100
- [x] Campo `purchasePrice` añadido a Property (para cálculo ROI)
- [x] Campo `deductible` (boolean) añadido a Expense
- [x] Filtros en Financials.tsx: propiedad, tipo, rango de fechas
- [x] Endpoint GET /api/financials/property/:propertyId/report?year=YYYY
- [x] Página PropertyFinancialDetail.tsx: KPIs, gráfico barras mensual, desglose por tipo y canal
- [x] Enlace "Ver finanzas" desde Properties a detalle financiero
- [x] Gastos recurrentes: modelo RecurringExpense, CRUD, cron diario 8:00, email notificación
- [x] Fix BookingStatusWorkflow: try/catch + mensaje de error visible + loading state
- [x] Fix traducción estados reserva: created→Creada, registered→Registrada, etc. en i18n
- [x] Fix statusColor para todos los estados (created|registered|processed|error|cancelled)
- [x] Fix edición masiva: llamadas secuenciales con delay para evitar ThrottlerException
- [x] Mass update BD: status 'pending' → 'created' en todas las reservas existentes
- [x] Configuración ramas: develop (trabajo) → main (producción)
- [x] Edición masiva en Reservas, Clientes y Gastos (cambio de estado/campo a varios)
- [x] Dashboard mejoras gráficos: selector vistas, circulares top10, mapa calor ocupación
- [x] Importación reservas desde Excel (POST /api/excel/import/bookings)
- [x] Integración Paperless-ngx: subida automática al firmar contrato
- [x] Paperless: configuración URL + Token + Document Type ID en Settings
- [x] Paperless: tags resueltos como IDs numéricos (resolveTagId)
- [x] Fix contratos: vista pública con token (sin login)
- [x] Fix contratos: SMTP lee configuración desde Organization en BD
- [x] Fix contratos: botón reenviar contrato
- [x] Fix contratos: imagen de firma incluida en PDF generado
- [x] Reportes avanzados: precio medio noche, ocupación vs ingresos, comparativa propiedades, estacionalidad, tendencia año a año, ingresos por canal, gastos por categoría, resumen fiscal anual
- [x] Sesión idle: detección de inactividad + mensaje de expiración + logout automático
- [x] Detalle propiedad como página dedicada /properties/:id (sin modal)
- [x] Fix finanzas propiedad en blanco en PropertyFinancialDetail.tsx
- [x] Layout ClientDetail: columna izquierda más estrecha, valoración visible
- [x] Dashboard Negocio: selector de periodos funcional (mes/trimestre/año)
- [x] Rentabilidad propiedad: KPIs anuales encima del selector de periodo
- [x] Templates contratos movidos dentro de pestaña Contratos
- [x] 2FA con OTP (TOTP): setup con QR, activación/desactivación desde perfil de usuario
- [x] Deploy producción: docker-compose.prod.yml, .env.example, README bilingüe, setup.sh, CONTRIBUTING.md

### Bugs sesión 17/03 (tarde) — RESUELTOS
- [x] Propiedades: página de editar con mismo formato que página de detalles
- [x] Propiedades: añadir botón "Editar" en página de detalle
- [x] Clientes: email desborda y solapa el idioma de contacto en detalle
- [x] Clientes: añadir botón "Editar" en página de detalle
- [x] Clientes: página de edición con mismo formato que página de detalle
- [x] Financials: página no muestra ingresos
- [x] Calendario: mejorar diseño del calendario mensual (más moderno, menos cuadrado)
- [x] Police.tsx: cambiar placeholder "Coming Soon" por "En desarrollo"
- [x] 2FA/TOTP: no visible en perfil de usuario — verificar implementación y rebuild Docker

### Sesión 16/03/2026
- [x] Propiedades: añadidos campos `country` y `postalCode`, rediseño de modales
- [x] Navegación anterior/siguiente en detalle (ClientDetail, BookingDetail, Properties)
- [x] Cambio de estado manual de reserva desde BookingDetail
- [x] Proyecto renombrado a RentalSuite (logo SVG pendiente de integrar)

### Sesión 14/03/2026
- [x] Filtros y ordenación en páginas Clients y Bookings
- [x] Layout ancho en ClientDetail y BookingDetail
- [x] Fix parpadeo en listado de reservas (staleTime + keepPreviousData)
- [x] Fix ClientDetail: usa `/api/bookings?clientId=` correctamente
- [x] Mejoras flujo reserva: debounce en búsqueda cliente, idioma por nacionalidad, validación solapamiento fechas
- [x] Backend + UI reglas de la casa (PropertyRules) por propiedad
- [x] Traducciones automáticas de reglas con LibreTranslate
- [x] Reglas de la casa en checkin online y en email de confirmación

### Sesión 12/03/2026
- [x] Fix endpoint SES: `/ws/comunicacion` (sin `/v1/`)
- [x] sesCodigoEstablecimiento movido de Organization a Property
- [x] Botón "Probar conexión SES" en Settings
- [x] Documentación: BEST_PRACTICES.md, COMMON_MISTAKES.md, TODO.md

### Sesión 11/03/2026
- [x] Workflow estados reserva con componente BookingStatusWorkflow
- [x] Auto-transiciones: checkin completo → registered; SES → processed/error
- [x] Fix modal edición reserva: campos correctos (checkInDate/checkOutDate/totalAmount)
- [x] Fix SSL en llamadas al Ministerio

### Sesión 10/03/2026
- [x] Dashboard con 4 pestañas: Resumen (KPIs + gráficos), Negocio, Clientes, Cumplimiento
- [x] Fix Dockerfile frontend: copia node_modules raíz (recharts hoisteado por npm workspaces)

### Sesiones anteriores
- [x] Responsive móvil: layout drawer, tarjetas móvil, modales fullscreen
- [x] Seguridad: 30 vulnerabilidades (SSL, JWT, IDOR, rate limiting, helmet, CORS)
- [x] Financials: vista anual con selector de año, CRUD gastos, totales
- [x] Properties: foto de propiedad, panel detalle rediseñado, resumen financiero anual
- [x] Excel: exportar/importar clientes, reservas, gastos, propiedades
- [x] Checkin online: enlace tokenizado, envío automático 2 días antes, página pública
- [x] LibreTranslate: self-hosted, 10 idiomas, caché + precalentamiento
- [x] Checkin: huéspedes adicionales +14 años guardados en BookingGuestSes
- [x] Login: validación campos vacíos + checkbox recordar usuario
- [x] SES backend: envío síncrono, sesLote, sesStatus (enviado/error)
