# RentCRM Pro — Estado del Proyecto
*Última actualización: 03/03/2026*

## Stack Tecnológico
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + TanStack Query
- **Backend:** NestJS + TypeScript + Prisma 7
- **Base de datos:** PostgreSQL 16
- **Cache:** Redis 7
- **Infraestructura:** Docker Compose en LXC Proxmox
- **CI/CD:** GitHub Actions (self-hosted runner)

## Infraestructura
- **LXC:** rentcrm@192.168.1.123
- **Frontend:** http://192.168.1.123:3000
- **API:** http://192.168.1.123:3001/api
- **PostgreSQL:** localhost:5432 (solo accesible internamente)
- **Redis:** interno Docker (sin puerto expuesto)
- **Repo:** github.com/grisalenajm/rentcrm-pro

## Credenciales Demo
- **Email:** admin@rentcrm.com
- **Password:** admin123
- **Rol:** admin

## Módulos Backend Completados ✅

### Auth
- Login con JWT
- Guards de autenticación y roles
- Roles: admin, gestor, consultor

### Users
- CRUD completo
- Gestión de contraseñas con bcrypt
- Endpoint GET /api/users/me

### Properties
- CRUD completo
- Soft delete
- Estados: active, maintenance, inactive

### Clients
- CRUD completo + búsqueda por nombre/DNI/email
- Soft delete
- Campos: nombre, DNI/pasaporte, nacionalidad, fecha nacimiento, email, teléfono, notas

### Bookings
- CRUD completo
- Validación de disponibilidad (sin solapamiento de fechas)
- Estado siempre "confirmed" al crear
- Fuentes: direct, airbnb, booking, vrbo, manual_block
- Soporte de huéspedes adicionales

### Financials
- CRUD completo
- Categorías de ingresos y gastos
- Endpoint summary con P&L (ingresos, gastos, beneficio)
- Filtros por propiedad, tipo, rango de fechas

### Contracts
- Templates con variables dinámicas {{variable}}
- Variables disponibles: ciudad, fecha, propietarioNombre, propietarioNif,
  propietarioDireccion, clienteNombre, clienteDni, propiedadDireccion,
  propiedadCiudad, fechaEntrada, fechaSalida, precioTotal, fianza,
  clausulas, fechaFirma
- Firma manuscrita digital (canvas base64)
- Token único por contrato para link público
- Estados: draft → sent → signed / cancelled
- Registro de IP del firmante
- Envío por email (requiere SMTP configurado)

**Templates creados:**
- Contrato Alquiler Vacacional (ES)
- Holiday Rental Agreement (EN)

## Módulos Frontend Completados ✅

### Login
- Autenticación con JWT
- Redirección automática si ya está logado

### Layout / Sidebar
- Navegación: Dashboard, Propiedades, Clientes, Reservas, Financiero, Partes SES
- Muestra usuario y rol
- Logout

### Dashboard
- Contador de propiedades activas
- Roadmap visual de funcionalidades

### Properties
- Listado en cards
- CRUD completo con modal
- Badge de estado (activa, mantenimiento, inactiva)

### Clients
- Listado en tabla
- Búsqueda en tiempo real
- CRUD completo con modal

### Bookings
- Listado en tabla con noches calculadas
- Crear reserva con cliente existente O nuevo cliente inline
- Cancelar reserva
- Estado siempre confirmado al crear

### Financials
- Summary P&L (ingresos, gastos, beneficio)
- Listado de registros
- Crear registro con categorías filtradas por tipo
- Eliminar registro

## Módulos Pendientes 🚧

### Frontend Pendiente
- **Contratos:** sección propia con lista + editor de templates + vista previa + firma
- **Partes SES:** integración con sistema de hospedajes
- **Dashboard mejorado:** gráficos, ocupación por propiedad, calendario

### Backend Pendiente
- **Police Reports (SES Hospedajes):** generación y envío de partes
- **iCal Sync:** sincronización con Airbnb/Booking/Vrbo

## Variables de Entorno Requeridas
```env
DATABASE_URL=postgresql://rentcrm:PASSWORD@postgres:5432/rentcrm
POSTGRES_PASSWORD=...
JWT_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=7d
REDIS_URL=redis://redis:6379
FRONTEND_URL=http://192.168.1.123:3000
# Opcional para envío de emails:
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@rentcrm.com
```

## Decisiones de Diseño Tomadas
1. **Precio por noche** en propiedad es orientativo — el precio real lo introduce el gestor al crear la reserva o viene de la plataforma
2. **Reservas directas** → precio manual por el gestor
3. **Reservas de plataforma** → precio de la plataforma registrado manualmente
4. **Estado de reserva** → siempre "confirmed" al crear (sin estado pendiente)
5. **Firma de contratos** → firma manuscrita digital en navegador, sin servicios externos
6. **Templates de contrato** → múltiples según tipo de alquiler (vacacional, larga estancia, etc.)
7. **Build strategy** → npm install + build en runner, Docker solo ejecuta binarios

## Estructura del Monorepo
```
rentcrm-pro/
├── apps/
│   ├── api/          — NestJS backend
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── properties/
│   │   │   ├── clients/
│   │   │   ├── bookings/
│   │   │   ├── financials/
│   │   │   └── contracts/
│   │   └── prisma/
│   └── frontend/     — React frontend
│       └── src/
│           ├── pages/
│           ├── components/
│           ├── context/
│           └── lib/
├── docker-compose.yml
└── .github/workflows/deploy.yml
```
