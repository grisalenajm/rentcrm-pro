# RentCRM Pro — Tareas pendientes

## En progreso
(ninguna)

## Pendiente (priorizado)

### Financials
- [ ] Filtros por columna, propiedad y fecha en página Financials
- [ ] Página detalle financiero por propiedad: ingresos/gastos mensuales y anuales con selector de periodo
- [ ] Reportes: rentabilidad y ROI por propiedad, precio medio noche, ocupación vs ingresos, comparativa entre propiedades, estacionalidad, tendencia año a año, ingresos por canal (airbnb/booking/direct), valor medio por reserva por canal, gastos por categoría, gastos fijos vs variables, alertas de gastos inusuales, resumen fiscal anual
- [ ] Campo `deducible` (boolean) en gastos — resumen fiscal reporta 100% del importe de la factura
- [ ] Gastos recurrentes por propiedad: frecuencia (mensual/trimestral/anual), día del mes, fecha inicio y fin opcionales, email automático al gestor cuando se contabiliza

### Dashboard
- [ ] Selector mensual/anual/comparativa por año en todos los gráficos
- [ ] Gráficas circulares: top 10 individual + resto agrupado en "Otros"
- [ ] Mapa de calor de días ocupados con selector de propiedad

### UX
- [ ] Mass edit desde página general de clientes, reservas y propiedades
- [ ] Mass update de precios de reservas desde Excel: modo 1 por ID de reserva, modo 2 por nombre de propiedad + fecha de entrada

### Git
- [ ] Configurar rama `develop` para desarrollo, `main` para producción
- [ ] Tags semánticos v1.0.0, v1.1.0 en cada release

### Rebranding
- [ ] Integrar logo e icono SVG de RentalSuite en la app (pendiente de tener los SVG exportados)

### Producción
- [ ] docker-compose.prod.yml sin Nginx
- [ ] .env.example documentado en inglés
- [ ] README.md en inglés con instrucciones de instalación
- [ ] setup.sh automatizado

### SES / Compliance
- [ ] Darse de alta en https://hospedajes.ses.mir.es
- [ ] Una vez dado de alta: verificar que el envío funciona desde la app
- [ ] Si sigue 404: probar sin comprimir el XML (quitar `deflate` en ses.service.ts ~línea 220)
- [ ] Añadir log de `err.response?.data` en el catch de ses.service.ts (~línea 279)
- [ ] Página Partes SES: historial de envíos con filtros y reenvío (pendiente licencia SES Hospedajes)
- [ ] Notificación email cuando SES devuelve error
- [ ] CSV NRUA/VAU para Depósito de Arrendamientos Comunidad Valenciana (pendiente especificación técnica)

## Completado

### Sesión 16/03/2026
- [x] Propiedades: campos `country` y `postalCode` (ya en schema/DTOs, sincronizado con `db push`) + rediseño modales crear/editar/ver con patrón visual consistente (cards `bg-slate-800/40 border border-slate-700 rounded-xl`, `inputCls`/`labelCls` constants)
- [x] Navegación anterior/siguiente en ClientDetail y BookingDetail: flechas ← → con contador posición/total, IDs pasados via React Router state `{ ids, index }` desde los listados
- [x] Cambio de estado manual de reserva desde BookingDetail: modal centrado con transiciones válidas, badge de estado, solo visible para admin/gestor, PATCH `/api/bookings/:id/status`

### Sesión 14/03/2026 (tarde)
- [x] Dashboard rediseñado con 4 pestañas (recharts): Resumen, Negocio, Clientes, Cumplimiento
- [x] Fix Dockerfile frontend: copiar root node_modules (hoisting npm workspaces)
- [x] Documentación actualizada: README, ESTADO_PROYECTO, TODO

### Sesión 14/03/2026 (mañana)
- [x] Mejoras flujo reserva: búsqueda cliente con debounce, idioma por nacionalidad, validación solapamiento fechas
- [x] Fix parpadeo reservas en lista de clientes (staleTime + keepPreviousData)
- [x] Fix ClientDetail: reservas visibles via GET /api/bookings?clientId= (antes usaba evaluations/summary)
- [x] Filtros y ordenación por columna en Clients.tsx y Bookings.tsx
- [x] Layout dos columnas y ancho completo en ClientDetail y BookingDetail
- [x] Backend reglas de la casa: modelo PropertyRules, endpoints GET/PUT/translate, houseRules en checkin
- [x] UI reglas de la casa en PropertyDetail: editor + traducciones por idioma
- [x] Reglas de la casa en checkin online y email de checkin

### Sesión 12/03/2026
- [x] Fix endpoint SES: `/ws/v1/comunicacion` → `/ws/comunicacion`
- [x] sesCodigoEstablecimiento movido de Organization a Property
- [x] Botón "Probar conexión SES" en Settings
- [x] Documentación actualizada: CLAUDE.md, BEST_PRACTICES.md, COMMON_MISTAKES.md, TODO.md

### Sesión 11/03/2026
- [x] Workflow estados reserva: created→registered→processed/error/cancelled
- [x] Componente BookingStatusWorkflow
- [x] Auto-transiciones en checkin y SES
- [x] Fix modal edición reserva: checkInDate/checkOutDate/totalAmount
- [x] Fix SSL SES: rejectUnauthorized false

### Sesiones anteriores
- [x] Responsive móvil completo
- [x] Seguridad: 30 vulnerabilidades resueltas
- [x] Financials: vista anual, CRUD gastos, totales
- [x] Properties: foto, panel detalle, resumen financiero
- [x] Excel: exportar/importar clientes, reservas, gastos, propiedades
- [x] Checkin online: tokenizado, envío automático, página pública
- [x] LibreTranslate: self-hosted, 10 idiomas, caché
- [x] Login: validación + checkbox recordar usuario
