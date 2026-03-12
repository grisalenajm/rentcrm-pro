# RentCRM Pro — Errores comunes ya cometidos

## Nombres de campos incorrectos
- ❌ booking.startDate / booking.endDate / booking.totalPrice
- ✅ booking.checkInDate / booking.checkOutDate / booking.totalAmount
- Causa: campos renombrados en migración, el frontend quedó desactualizado

## Docker no recarga el código
- ❌ docker compose restart frontend
- ✅ docker compose up -d --build frontend
- Causa: restart no reconstruye la imagen, sirve código antiguo

## Conflicto nombre de contenedor al rebuild
- Error: 'The container name /rentcrm-api is already in use'
- ✅ docker rm -f rentcrm-api && docker compose up -d --build api

## Rutas :id antes de rutas fijas
- ❌ GET /:id definida antes de GET /checkin/:token en el controlador
- ✅ Rutas con path literal SIEMPRE antes de parámetros dinámicos
- Causa: Express/NestJS evalúa rutas en orden de definición

## URL de API desde el navegador
- ❌ http://api:3001 desde el navegador
- ✅ /api (relativo, Vite proxy) o http://192.168.1.123:3001 desde móviles externos
- Causa: api:3001 solo resuelve dentro de la red Docker

## Listas de países duplicadas
- ❌ Crear arrays de países inline en cada componente
- ✅ Importar WORLD_COUNTRIES desde src/data/countries.ts

## DTO sin decoradores con ValidationPipe whitelist
- ❌ Campo en DTO sin @IsString() @IsOptional() → silently stripped por whitelist
- ✅ TODOS los campos del DTO necesitan decoradores de class-validator

## Rutas públicas sin @Public()
- ❌ Quitar @UseGuards() para hacer ruta pública → sigue protegida por guard global
- ✅ Usar @Public() decorator para rutas sin JWT

## sesCodigoEstablecimiento en lugar equivocado
- ❌ Campo sesCodigoEstablecimiento en modelo Organization
- ✅ Pertenece a Property (cada propiedad tiene su propio código SES)

## Modal de edición con campos vacíos
- Causa: openEdit() leía booking.startDate pero API devuelve booking.checkInDate
- Lección: siempre verificar nombres de campos con grep en schema.prisma antes de usarlos en frontend

## statusColor sin nuevos estados
- Causa: al añadir nuevos valores de status, olvidar actualizar el objeto statusColor en cada página
- Lección: buscar todos los statusColor del proyecto al añadir nuevos estados

## Prisma desde dentro del contenedor
- ❌ docker exec rentcrm-api npx prisma migrate dev
- ✅ Desde el host con DATABASE_URL explícita apuntando a localhost:5432

## Error SSL en llamadas al SES del Ministerio
- Error: 'unable to verify the first certificate'
- Causa: el endpoint del Ministerio usa un certificado no reconocido por Node.js
- ✅ Solución: añadir httpsAgent: new https.Agent({ rejectUnauthorized: false }) en la llamada axios
- Nota: solo aplicar en llamadas al SES, no deshabilitar SSL globalmente
