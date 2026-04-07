# RentalSuite — Tareas pendientes
> Actualizado 07/04/2026

## En progreso
(ninguna)

## Completadas recientemente

### Inventario (sesiones 1–5 + correcciones 07/04/2026)
- [x] Modelo `Material` — CRUD + código de barras Code128 auto-generado (`MAT-00000001`)
- [x] Modelo `StockMovement` — movimientos entrada/salida/recuento por propiedad
- [x] Valoración al último precio de entrada
- [x] Módulo `/inventory` con 3 pestañas: Master Data, Stock, Recuento
- [x] Rol `inventario` — acceso exclusivo al módulo /inventory (sin crear/editar materiales)
- [x] Validación stock negativo — backend rechaza salidas si quantity > stockActual
- [x] `unitPrice` en salidas calculado automáticamente desde el último precio de entrada
- [x] Alertas de stock mínimo (`minStock`)
- [x] Recuento masivo por propiedad

### Otras (07/04/2026)
- [x] Mass update precios de reservas desde Excel (`GET /excel/template/bookings-price`, `POST /excel/import/bookings-price`)
- [x] Cambio contraseña desde perfil para usuarios no admin (`PUT /users/me/password`)

## Pendiente (priorizado)

### Alta
- [ ] `Police.tsx` — historial de envíos SES con filtros y opción de reenvío (actualmente placeholder)
- [ ] Email de notificación cuando SES devuelve error

### Media
- [ ] Etiquetas de códigos de barras — página de impresión con grid (imagen barcode + nombre material, CSS print)
- [ ] iCal: URL de export usando dominio externo `crm.greywoodhome.es` (via `API_PUBLIC_URL`)
- [ ] iCal: tamaño de feeds Airbnb/Booking.com en la UI

### Baja
- [ ] Integrar SVG logo RentalSuite en la app
- [ ] Mover configuración Paperless a Settings → pestaña Integraciones
- [ ] HTTPS local con mkcert (CA Proxmox ya copiada)
- [ ] Notificaciones push (check-in próximo, contratos sin firmar, pagos pendientes)
- [ ] Alta en hospedajes.ses.mir.es (activar envío real de partes SES)
- [ ] Properties: crear nueva propiedad en página completa /properties/new (sin modal)

### Deploy producción
- [ ] `docker-compose.prod.yml` limpio
- [ ] `.env.example` documentado
- [ ] `README.md` bilingüe profesional para GitHub
- [ ] `setup.sh` script de instalación
- [ ] `CONTRIBUTING.md`
