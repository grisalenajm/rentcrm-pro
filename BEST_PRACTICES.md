# RentalSuite — Best Practices
> Actualizado 27/03/2026

## Deploy (CRÍTICO)
- API: `npm run build --workspace=apps/api && docker compose build api && docker compose up -d api`
- Frontend: `docker compose up -d --build frontend`
- NUNCA solo `docker compose restart`
- Si log de debug no aparece: repetir `npm run build` explícito
- Conflicto contenedor: `docker rm -f rentcrm-api && docker compose up -d api`

## Prisma (CRÍTICO)
- SIEMPRE desde el host, NUNCA desde el contenedor
- El `apps/api/.env` usa Prisma Accelerate — NO sirve para CLI
- Usar siempre la password de `~/rentcrm-pro/.env`:
```bash
cat ~/rentcrm-pro/.env | grep POSTGRES_PASSWORD
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' npx prisma migrate dev --name nombre
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' npx prisma generate
```
- Si `migrate dev` falla "migration modified": usar `prisma db push`
- Tras cambios en schema: `npx prisma generate` antes de build

## Nombres de campos (CRÍTICO)
- Booking: `checkInDate`, `checkOutDate`, `totalAmount`, `externalId`
- Booking.status: `created|registered|processed|error|cancelled`
- Booking.source: `direct|airbnb|booking|vrbo|manual_block`
- Property: `sesCodigoEstablecimiento`, `paperlessCorrespondentId`, `nrua`
- Expense: `deductible`, `paperlessDocumentId`, `paperlessAmount`
- Organization: `paperlessUrl`, `paperlessToken`, `paperlessSecret`

## Git
- Commits en inglés (repo público), SIN Co-Authored-By
- Push a develop tras cada tarea
- Merge a main solo cuando está verificado

## Frontend
- Vite NO tiene hot reload real en Docker — siempre rebuild
- `api.ts` usa `baseURL: '/api'` relativo
- Tokens UI centralizados en `src/lib/ui.ts` — NUNCA hardcodear clases
- Clipboard API solo funciona en HTTPS
- Arrays async (DOC_TYPES, etc.) → `useMemo` dentro del componente
- React Query: `staleTime` + `keepPreviousData` en listados
- Idle timeout: constante `IDLE_TIMEOUT_MS` en `src/context/AuthContext.tsx` (actualmente 15 min)

## Backend NestJS
- Rutas fijas SIEMPRE antes de `:id` en el controlador
- Rutas públicas: `@Public()` decorator
- ValidationPipe whitelist: todos los campos del DTO con decoradores
- SMTP y Paperless config: siempre desde Organization en BD

## Llamadas externas
- SES Ministerio: `rejectUnauthorized: false` solo en esa llamada
- Siempre loguear `err.response?.data` Y `err.message` en catch
- Paperless webhook: validar X-Paperless-Secret antes de procesar

## Infraestructura
- Corre en LXC Proxmox (no VM) — acceder con `pct enter 123`
- Acceso externo: Nginx + Let's Encrypt
- HTTPS local: mkcert con CA de Proxmox (ver CLAUDE.md)
- Clipboard API requiere HTTPS — no funciona en HTTP local
