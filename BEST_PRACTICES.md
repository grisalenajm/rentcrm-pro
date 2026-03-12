# RentCRM Pro — Best Practices

## Deploy (CRÍTICO)
- SIEMPRE: docker compose up -d --build (NUNCA solo restart — no recarga código)
- API cambiada: docker compose up -d --build api
- Frontend cambiado: docker compose up -d --build frontend
- Ambos: docker compose up -d --build api frontend
- Conflicto de nombre de contenedor: docker rm -f rentcrm-api && docker compose up -d --build api
- Tras cada tarea: git add -A && git commit -m 'mensaje en español' && git push origin main

## Prisma (CRÍTICO)
- SIEMPRE ejecutar desde el host, NUNCA desde dentro del contenedor
- SIEMPRE pasar DATABASE_URL explícita: DATABASE_URL='postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm' npx prisma migrate dev --name nombre
- Si migrate dev falla 'migration modified': usar prisma db push en desarrollo
- SIEMPRE verificar nombres exactos de campos en schema.prisma antes de usarlos en código
- Tras cambios en schema: npx prisma generate antes de build

## Nombres de campos (CRÍTICO — errores frecuentes)
- Booking: checkInDate, checkOutDate, totalAmount (NO startDate/endDate/totalPrice)
- Booking.status valores: created, registered, processed, error, cancelled
- Client: dirección estructurada con street, city, postalCode, province, country
- BookingGuestSes: mismos campos de dirección que Client

## Frontend
- Vite NO tiene hot reload real en Docker — siempre rebuild tras cambios
- api.ts usa baseURL '/api' relativo — NUNCA usar http://api:3001 desde el navegador
- Usar siempre WORLD_COUNTRIES desde src/data/countries.ts — NO crear listas de países inline
- Patrón responsive: sin prefijo = móvil primero, md: = 768px desktop
- Patrón tabla→tarjetas móvil: <div className='hidden md:block'><table/></div> + <div className='md:hidden'>
- Patrón modal fullscreen móvil: items-end md:items-center, rounded-t-2xl md:rounded-2xl

## Backend NestJS
- Rutas con path fijo SIEMPRE antes de :id en el controlador (ej: /checkin/:token antes de /:id)
- Rutas públicas sin JWT: usar @Public() decorator, NO @UseGuards() vacío
- ValidationPipe whitelist activo: TODOS los campos del DTO necesitan decoradores @IsString()/@IsOptional() etc.
- JWT payload contiene: id, email, organizationId, role

## i18n / Traducciones
- Traducciones en apps/frontend/src/i18n/index.ts (NO en ficheros JSON separados)
- Tras añadir nuevos estados o textos, actualizar TODOS los idiomas en index.ts
- Verificar que los statusColor de cada página incluyen los nuevos estados

## SES / Propiedades
- sesCodigoEstablecimiento pertenece a Property, NO a Organization
- Organization solo tiene: sesUsuarioWs, sesPasswordWs, sesCodigoArrendador, sesEndpoint
