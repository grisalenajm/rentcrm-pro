# RentCRM Pro — Tareas pendientes

## En progreso
(ninguna)

## Pendiente (priorizado)

### SES Hospedajes
- [ ] Darse de alta en https://hospedajes.ses.mir.es
- [ ] Una vez dado de alta: verificar que el envío funciona desde la app
- [ ] Si sigue 404: probar sin comprimir el XML (quitar `deflate` en ses.service.ts ~línea 220)
- [ ] Añadir log de `err.response?.data` en el catch de ses.service.ts (~línea 279)
- [ ] Página Partes SES: historial de envíos con navegación
- [ ] Consulta estado lote SES: confirmación asíncrona del Ministerio
- [ ] Notificación email SES: cuando confirma o rechaza

### Flujo de reservas
- [ ] Crear reserva solo con nombre (sin requerir todos los datos del cliente)
- [ ] Idioma automático por nacionalidad del cliente al crear reserva

### Contenido
- [ ] Documentos y reglas de la casa por propiedad con traducción automática al idioma del cliente

### Infraestructura
- [ ] Deploy producción: Nginx, VITE_API_URL relativo, docker-compose.prod.yml
- [ ] Versionado API: prefijo /api/v1/

## Completado

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
