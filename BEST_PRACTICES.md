# RentCRM Pro — Best Practices

## Deploy (CRÍTICO)
- El Dockerfile de la API copia el `dist/` precompilado del host — NUNCA compila dentro de Docker
- **API cambiada**: `npm run build --workspace=apps/api && docker compose build api && docker compose up -d api`
- **Frontend cambiado**: `docker compose up -d --build frontend`
- **Conflicto contenedor**: `docker rm -f rentcrm-api && docker compose up -d api`
- NUNCA solo `restart` — no recarga código
- Si el log de debug no aparece tras rebuild: el build no incluyó los cambios → repetir `npm run build` explícito
- Tras cada tarea: `git add -A && git commit -m 'mensaje en español' && git push origin main`

## Prisma (CRÍTICO)
- SIEMPRE desde el host, NUNCA desde dentro del contenedor
- SIEMPRE pasar DATABASE_URL explícita:
```bash
DATABASE_URL='postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm' npx prisma migrate dev --name nombre
```
- Si `migrate dev` falla 'migration modified': usar `prisma db push`
- SIEMPRE verificar nombres exactos de campos en schema.prisma antes de usarlos
- Tras cambios en schema: `npx prisma generate` antes de build

## Nombres de campos (CRÍTICO)
- Booking: `checkInDate`, `checkOutDate`, `totalAmount` (NO `startDate`/`endDate`/`totalPrice`)
- Booking.status: `created`, `registered`, `processed`, `error`, `cancelled`
- Client y BookingGuestSes: dirección con `street`, `city`, `postalCode`, `province`, `country`
- Property: `sesCodigoEstablecimiento`
- Organization: `sesUsuarioWs`, `sesPasswordWs`, `sesCodigoArrendador`, `sesEndpoint`

## Frontend
- Vite NO tiene hot reload real en Docker — siempre rebuild
- `api.ts` usa `baseURL: '/api'` relativo — NUNCA `http://api:3001` desde el navegador
- Usar siempre `WORLD_COUNTRIES` desde `src/data/countries.ts`
- Patrón responsive: sin prefijo = móvil, `md:` = 768px desktop
- Tabla→tarjetas: `hidden md:block` / `md:hidden`
- Modal fullscreen móvil: `items-end md:items-center`, `rounded-t-2xl md:rounded-2xl`

## i18n
- Traducciones en `apps/frontend/src/i18n/index.ts` — NO ficheros JSON separados
- Al añadir estados o textos: actualizar TODOS los idiomas
- Al añadir valores de `status`: actualizar también `statusColor` en cada página

## Backend NestJS
- Rutas fijas SIEMPRE antes de `:id` en el controlador
- Rutas públicas: `@Public()` decorator, NO `@UseGuards()` vacío
- `ValidationPipe whitelist`: TODOS los campos del DTO con decoradores
- JWT payload: `id`, `email`, `organizationId`, `role`

## Llamadas externas HTTPS
- SES Ministerio: `rejectUnauthorized: false` en el `httpsAgent` de axios
- NUNCA deshabilitar SSL globalmente
- Siempre loguear `err.response?.data` Y `err.message` en el catch

## SES Hospedajes
- `sesCodigoEstablecimiento` en `Property`, NO en `Organization`
- Endpoint correcto: `https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion` (SIN `/v1/`)
- La cuenta debe estar dada de alta en el Ministerio para que las peticiones funcionen
- Verificar si el Ministerio espera XML comprimido (deflate) o plano en base64

## Debugging
- Logs temporales: editar archivo → `npm run build --workspace=apps/api` → rebuild Docker
- Si el log no aparece: el build no recogió los cambios — repetir build
- Verificar valor en BD: `docker exec rentcrm-postgres psql -U rentcrm -d rentcrm -c "SELECT campo FROM tabla;"`
- Verificar respuesta de errores externos: loguear `err.response?.data` y `err.message`
