# RentCRM Pro — Tareas pendientes

## En progreso
(ninguna)

## Pendiente (priorizado)

### SES Hospedajes
- [ ] Darse de alta en https://hospedajes.ses.mir.es
- [ ] Una vez dado de alta: verificar que el envío funciona desde la app
- [ ] Si sigue 404: probar sin comprimir el XML (quitar `deflate` en ses.service.ts ~línea 220)
- [ ] Añadir log de `err.response?.data` en el catch de ses.service.ts (~línea 279)
- [ ] Página Partes SES: historial de envíos con filtros y reenvío
- [ ] Notificación email cuando SES devuelve error

### Infraestructura
- [ ] Deploy producción: docker-compose.prod.yml, .env.example, README, setup.sh
- [ ] Exportar CSV NRUA/VAU (esperando especificación técnica)

## Completado

### Sesión 14/03/2026
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
