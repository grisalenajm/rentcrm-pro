# RentCRM Pro — Tareas pendientes

## En progreso
(ninguna)

## Pendiente
- [ ] Mejoras flujo reserva: solo nombre al crear reserva, idioma automático por nacionalidad del cliente
- [ ] Documentos y reglas de la casa: por propiedad, traducción automática al idioma del cliente
- [ ] Página Partes SES: historial de envíos con navegación
- [ ] Consulta estado lote SES: confirmación asíncrona Ministerio
- [ ] Notificación email SES: cuando confirma o rechaza
- [ ] Deploy producción: Nginx, VITE_API_URL relativo, docker-compose.prod.yml
- [ ] Versionado API: prefijo /api/v1/

## Completado
- [x] Workflow estados reserva: created→registered→processed/error/cancelled
- [x] Fix modal edición reserva: campos checkInDate/checkOutDate/totalAmount
- [x] Responsive móvil: layout drawer, tarjetas móvil, modales fullscreen
- [x] Seguridad: SSL, JWT, IDOR, rate limiting, helmet, CORS
- [x] Financials: vista anual, CRUD gastos, totales
- [x] Properties: foto, panel detalle, resumen financiero
- [x] Excel: exportar/importar clientes, reservas, gastos, propiedades
- [x] Checkin online: enlace tokenizado, envío automático, página pública
- [x] LibreTranslate: self-hosted, 10 idiomas, caché y precalentamiento
