# RentCRM Pro — Errores comunes ya cometidos

## Nombres de campos incorrectos en Booking
- ❌ `booking.startDate` / `booking.endDate` / `booking.totalPrice`
- ✅ `booking.checkInDate` / `booking.checkOutDate` / `booking.totalAmount`
- Lección: verificar siempre con `grep "fieldName" apps/api/prisma/schema.prisma`

## Docker no recarga el código
- ❌ `docker compose restart frontend`
- ✅ `docker compose up -d --build frontend`

## API no recarga con solo docker compose build
- ❌ `docker compose build api && docker compose up -d api` sin compilar antes
- ✅ `npm run build --workspace=apps/api && docker compose build api && docker compose up -d api`
- Señal: log de debug añadido no aparece en `docker logs`

## Conflicto nombre de contenedor
- Error: `The container name /rentcrm-api is already in use`
- ✅ `docker rm -f rentcrm-api && docker compose up -d --build api`

## Rutas :id antes de rutas fijas
- ❌ `GET /:id` antes de `GET /checkin/:token`
- ✅ Rutas con path literal SIEMPRE antes de parámetros dinámicos

## URL de API desde el navegador
- ❌ `http://api:3001` desde el navegador
- ✅ `/api` (Vite proxy) o `http://192.168.1.123:3001` desde móviles

## Listas de países duplicadas
- ❌ Arrays de países inline en cada componente
- ✅ `WORLD_COUNTRIES` desde `src/data/countries.ts`

## DTO sin decoradores con ValidationPipe whitelist
- ❌ Campo sin `@IsString()` `@IsOptional()` → eliminado silenciosamente
- ✅ TODOS los campos del DTO con decoradores de class-validator

## Rutas públicas sin @Public()
- ❌ Quitar `@UseGuards()` → sigue protegida por guard global
- ✅ Usar `@Public()` decorator

## sesCodigoEstablecimiento en lugar equivocado
- ❌ Campo en modelo `Organization`
- ✅ Pertenece a `Property`

## Modal de edición con campos vacíos
- Causa: `openEdit()` leía `booking.startDate` pero API devuelve `booking.checkInDate`

## statusColor sin nuevos estados
- Al añadir valores de `status`: buscar todos los `statusColor` del proyecto y actualizarlos

## Traducciones en ficheros JSON separados
- ❌ `es.json`, `en.json`, etc.
- ✅ Todo en `apps/frontend/src/i18n/index.ts`

## Prisma desde dentro del contenedor
- ❌ `docker exec rentcrm-api npx prisma migrate dev`
- ✅ Desde el host con `DATABASE_URL` explícita → `localhost:5432`

## Error SSL en llamadas al SES
- Error: `unable to verify the first certificate`
- ✅ `httpsAgent: new https.Agent({ rejectUnauthorized: false })` solo en esa llamada axios

## Endpoint SES incorrecto
- ❌ `.../ws/v1/comunicacion` → 404
- ✅ `.../ws/comunicacion` (sin `/v1/`)

## UPDATE en BD que no persiste
- Síntoma: `UPDATE 1` pero SELECT muestra valor anterior
- ✅ Usar `WHERE campo LIKE '%valor%'` y verificar con SELECT inmediatamente después

## Catch de error sin información útil
- ❌ Catch genérico sin `err.response?.data`
- ✅ Loguear siempre `err.message` Y `err.response?.data`

## Rate limit en operaciones bulk
- ❌ Endpoints de edición masiva sin `@SkipThrottle()` → throttle error al actualizar muchos registros
- ✅ Añadir `@SkipThrottle()` en métodos bulk del controlador

## Gastos recurrentes: campo deductible vs deducible
- ❌ `deducible` en el modelo (sin t)
- ✅ `deductible` (con t) — nombre en inglés consistente con el resto del schema

## SES Hospedajes namespace SOAP incorrecto
- ❌ `xmlns:com="http://hospedajes.ses.mir.es/"` → HTTP 404 del Ministerio
- ✅ `xmlns:com="http://www.soap.servicios.hospedajes.mir.es/comunicacion"` (namespace oficial v3.1.3)
- Lección: el namespace incorrecto causa 404, no un error SOAP — difícil de diagnosticar

## SES elemento SOAP incorrecto
- ❌ `<com:comunicacion>` como elemento raíz dentro del Body → el Ministerio rechaza la petición
- ✅ `<com:comunicacionRequest>` (API v3.1.3) — afecta a sendToSes, consultarLote y testConnection

## SES SSL error en PRD (UNABLE_TO_VERIFY_LEAF_SIGNATURE)
- Causa: imagen Docker (Alpine) no incluye los CAs de FNMT en su trust store
- ✅ Solución: añadir certs al Dockerfile del API (runner stage):
  - apps/api/certs/fnmt-ac-componentes.crt — CA intermedia (firma *.ses.mir.es)
  - apps/api/certs/fnmt-ac-raiz.crt — CA raíz (AC RAIZ FNMT-RCM)
  - Descargados desde AIA extension del endpoint: cert.fnmt.es
  ```dockerfile
  COPY apps/api/certs/fnmt-ac-componentes.crt /usr/local/share/ca-certificates/
  COPY apps/api/certs/fnmt-ac-raiz.crt /usr/local/share/ca-certificates/
  RUN apk add --no-cache ca-certificates && update-ca-certificates
  ```
- Nota: mir-ca.pem en certs/ ya estaba presente y es usado por httpsAgent en SesService
- En DEV funciona porque rejectUnauthorized: false bypasea la validación

## Parser de importe Paperless: formato europeo
- ❌ `.replace(/[^0-9.,]/g, '').replace(',', '.')` → `EUR1.476,20` produce `1.476` (incorrecto)
- ✅ Si el string contiene coma: quitar todos los puntos primero (miles), luego coma→punto
  ```ts
  const raw = String(val).replace(/[^0-9.,]/g, '');
  const cleaned = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  ```
- `EUR1.476,20` → `1476.20` ✓  |  `EUR1234.00` → `1234.00` ✓
