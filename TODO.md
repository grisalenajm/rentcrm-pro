# RentalSuite — Tareas pendientes
> Actualizado 08/04/2026 (tarde)

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

### SES / Infraestructura (07/04/2026)
- [x] Fix SES SSL en PRD: importar CAs FNMT (ac-componentes + ac-raiz) en imagen Docker Alpine

### Otras (07/04/2026)
- [x] Mass update precios de reservas desde Excel (`GET /excel/template/bookings-price`, `POST /excel/import/bookings-price`)
- [x] Cambio contraseña desde perfil para usuarios no admin (`PUT /users/me/password`)
- [x] Endpoint seed `POST /api/seed` — crea org + admin inicial, 409 si ya existe usuario
- [x] URLs iCal sin truncate — `break-all` + botón Copiar con fallback HTTP

### iCal (08/04/2026)
- [x] `API_PUBLIC_URL` — `getExportUrl` usa `API_PUBLIC_URL` env var (fallback `FRONTEND_URL`) para que la URL exportada apunte al host de la API, no al dominio frontend
- [x] Página iCal `/properties/:id/ical` — modal convertido a página completa con badge de eventos, `lastSyncAt` relativo ("Hace 2h"), estilo dark card igual que PropertyDetail; botón iCal en Properties y PropertyDetail navega a la nueva ruta

### Reconciliación repo (08/04/2026)
- [x] `Police.tsx` historial SES — ya implementado: tabla con filtros estado/propiedad/mes, reenvío con modal, descarga XML/PDF, cards mobile
- [x] `setup.sh` — ya existe (v2.0.0)
- [x] `CONTRIBUTING.md` — ya existe
- [x] `.env.example` — ya existe y documentado

## Pendiente (priorizado)

### Alta
- [ ] Email de notificación cuando SES devuelve error

### Media
- [ ] Etiquetas de códigos de barras — página de impresión con grid (imagen barcode + nombre material, CSS print)

### Baja
- [ ] Integrar SVG logo RentalSuite en la app
- [ ] Mover configuración Paperless a Settings → pestaña Integraciones
- [ ] HTTPS local con mkcert (CA Proxmox ya copiada)
- [ ] Notificaciones push (check-in próximo, contratos sin firmar, pagos pendientes)
- [ ] Alta en hospedajes.ses.mir.es (activar envío real de partes SES)
- [ ] Properties: crear nueva propiedad en página completa /properties/new (sin modal)

### Deploy producción
- [x] `docker-compose.prod.yml` + GitHub Actions build/push a ghcr.io
- [x] `.env.example` documentado
- [x] `setup.sh` script de instalación
- [x] `CONTRIBUTING.md`
- [ ] `README.md` bilingüe profesional para GitHub (revisar si está completo o es borrador)
