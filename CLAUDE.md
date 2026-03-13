# RentCRM Pro — Guía para Claude Code

## Entorno
- **Repo**: `/home/rentcrm/rentcrm-pro` (monorepo npm workspaces)
- **Frontend**: `apps/frontend/` → puerto 3000 (Vite dev server dentro de Docker — **requiere rebuild** para ver cambios)
- **API**: `apps/api/` → puerto 3001 (NestJS, prefijo `/api`)
- **DB**: PostgreSQL → `postgresql://rentcrm:[ver .env]@localhost:5432/rentcrm`
- **Redis**: `redis://:[ver .env]@localhost:6379`
- **LibreTranslate**: `http://localhost:5000` (externo) / `http://libretranslate:5000` (interno Docker)

## Contenedores Docker
```
rentcrm-api        → NestJS API (puerto 3001)
rentcrm-frontend   → Vite React (puerto 3000)
rentcrm-postgres   → PostgreSQL 15
rentcrm-redis      → Redis 7
rentcrm-translate  → LibreTranslate (puerto 5000)
```

## Comandos esenciales

### Deploy API (SIEMPRE así, nunca solo restart)
```bash
cd ~/rentcrm-pro
npm run build --workspace=apps/api
docker compose build api && docker compose up -d api
docker logs rentcrm-api --tail=20
```

### Migraciones Prisma (SIEMPRE desde el host, nunca desde el contenedor)
```bash
cd ~/rentcrm-pro/apps/api
DATABASE_URL="postgresql://rentcrm:[ver .env]@localhost:5432/rentcrm" npx prisma migrate dev --name nombre-migracion
DATABASE_URL="postgresql://rentcrm:[ver .env]@localhost:5432/rentcrm" npx prisma generate
# Si falla "migration modified": usar db push en desarrollo
DATABASE_URL="postgresql://rentcrm:[ver .env]@localhost:5432/rentcrm" npx prisma db push
```

### Frontend (requiere rebuild — NO hay hot reload real en el contenedor)
```bash
docker compose build frontend && docker compose up -d frontend
docker logs rentcrm-frontend --tail=5
```

### Git
```bash
cd ~/rentcrm-pro && git add -A && git commit -m "mensaje" && git push origin main
```

## Estructura de archivos clave
```
rentcrm-pro/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma          ← MODELOS DE BD
│   │   │   └── migrations/            ← historial migraciones
│   │   └── src/
│   │       ├── main.ts                ← bootstrap, puerto 3001
│   │       ├── app.module.ts          ← módulos registrados
│   │       ├── auth/
│   │       │   ├── jwt-auth.guard.ts  ← respeta @Public()
│   │       │   └── public.decorator.ts← @Public() para rutas sin JWT
│   │       ├── bookings/
│   │       │   ├── bookings.controller.ts  ← IMPORTANTE: rutas checkin ANTES de :id
│   │       │   ├── bookings.service.ts
│   │       │   ├── ses.service.ts     ← lógica SES/SOAP Ministerio
│   │       │   └── dto/
│   │       │       ├── create-booking.dto.ts
│   │       │       └── update-booking.dto.ts
│   │       ├── clients/
│   │       ├── properties/
│   │       ├── expenses/              ← CRUD gastos por propiedad
│   │       ├── excel/                 ← exportar/importar Excel
│   │       ├── organization/          ← config SMTP, SES, logo
│   │       ├── translation/
│   │       │   ├── translation.service.ts  ← caché + precalentamiento
│   │       │   └── translation.module.ts
│   │       └── prisma/
│   │           └── prisma.service.ts
│   └── frontend/
│       └── src/
│           ├── main.tsx
│           ├── App.tsx                ← rutas React Router
│           ├── i18n/
│           │   └── index.ts           ← TODAS las traducciones aquí (NO ficheros JSON)
│           ├── context/
│           │   └── AuthContext.tsx    ← JWT en memoria (no localStorage)
│           ├── data/
│           │   └── countries.ts       ← 195 países ISO 3166-1 (WORLD_COUNTRIES)
│           ├── components/
│           │   ├── Layout.tsx              ← drawer móvil hamburguesa
│           │   ├── ExcelButtons.tsx        ← exportar/importar reutilizable
│           │   └── BookingStatusWorkflow.tsx ← badge estado + botones transición
│           └── pages/
│               ├── Dashboard.tsx
│               ├── Bookings.tsx
│               ├── BookingDetail.tsx  ← editar reserva, checkin, evaluaciones
│               ├── Clients.tsx
│               ├── ClientDetail.tsx
│               ├── Properties.tsx
│               ├── Financials.tsx     ← gastos + totales anuales
│               ├── Calendar.tsx
│               ├── Contracts.tsx
│               ├── Police.tsx         ← partes SES
│               ├── Settings.tsx       ← config org, SMTP, SES (botón test conexión)
│               └── CheckinPage.tsx    ← página PÚBLICA /checkin/:token
```

## Modelos Prisma principales (schema.prisma)
```prisma
model Booking {
  id             String    @id @default(uuid())
  propertyId     String
  clientId       String?
  checkInDate    DateTime              // ← OJO: checkInDate, NO startDate
  checkOutDate   DateTime              // ← OJO: checkOutDate, NO endDate
  totalAmount    Float?                // ← OJO: totalAmount, NO totalPrice
  status         String    @default("created")  // created|registered|processed|error|cancelled
  source         String?
  notes          String?
  checkinToken   String?   @unique
  checkinStatus  String?   @default("pending")
  checkinSentAt  DateTime?
  checkinDoneAt  DateTime?
  sesLote        String?
  sesStatus      String?
  sesSentAt      DateTime?
  property       Property  @relation(...)
  client         Client?   @relation(...)
  guests         BookingGuestSes[]
}

model Client {
  id             String    @id @default(uuid())
  firstName      String
  lastName       String
  dniPassport    String?
  nationality    String?
  birthDate      DateTime?
  email          String?
  phone          String?
  street         String?
  city           String?
  postalCode     String?   @map("postal_code")
  province       String?
  country        String?   @db.VarChar(5)
  notes          String?
  language       String?   @default("es")
  organizationId String
}

model Property {
  id                       String  @id @default(uuid())
  name                     String
  address                  String?
  city                     String?
  photo                    String?
  icalUrl                  String?
  sesCodigoEstablecimiento String? // ← código SES por propiedad, NO en Organization
  organizationId           String
}

model Expense {
  id         String   @id @default(uuid())
  propertyId String
  date       DateTime
  amount     Float
  type       String   // tasas|agua|luz|internet|limpieza|otros
  notes      String?
  organizationId String
}

model BookingGuestSes {
  id         String    @id @default(uuid())
  bookingId  String
  firstName  String
  lastName   String
  docType    String
  docNumber  String
  docCountry String
  birthDate  DateTime?
  phone      String?
  street     String?
  city       String?
  postalCode String?   @map("postal_code")
  province   String?
  country    String?
  booking    Booking   @relation(...)
}

model Organization {
  sesUsuarioWs        String?
  sesPasswordWs       String?
  sesCodigoArrendador String?
  sesEndpoint         String?  // https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion
  // sesCodigoEstablecimiento NO va aquí, va en Property
}
```

## Variables de entorno clave (.env en apps/api/)
```
DATABASE_URL=postgresql://rentcrm:[ver .env]@postgres:5432/rentcrm
REDIS_URL=redis://:[ver .env]@redis:6379
JWT_SECRET=...
FRONTEND_URL=http://192.168.1.123:3000
LIBRETRANSLATE_URL=http://libretranslate:5000
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
```

## Roles de usuario
| Rol | Permisos |
|-----|----------|
| `admin` | Todo |
| `gestor` | Crear/editar bookings, clients, properties, contracts, SES, checkin |
| `owner` | Solo gastos |
| `viewer` | Solo lectura (GET) |

JWT payload: `{ id, email, organizationId, role }`

## Patrones importantes

### Rutas públicas (sin JWT)
```typescript
@Public()
@Get('checkin/:token')
getCheckin() {}
// IMPORTANTE: rutas con parámetro fijo ANTES de :id en el controlador
```

### Workflow estados de reserva
```
created    → registered | cancelled
registered → processed  | error | cancelled
error      → registered | processed | cancelled
processed  → (final)
cancelled  → (final)
```
- Colores: created=amber, registered=blue, processed=emerald, error=red, cancelled=slate

### TranslationService
```typescript
// 10 idiomas: es, en, fr, de, it, pt, nl, da, nb, sv
// Timeouts en sv al arrancar son normales — no son errores
await this.translationService.translateMany([...textos], lang);
```

### Frontend — routing API
- `api.ts` usa `baseURL: '/api'` relativo → Vite proxy redirige a `http://api:3001`
- `CheckinPage.tsx` usa `VITE_API_URL + '/api'` directo (página pública)
- NO usar `http://api:3001` desde el navegador

### i18n
- TODAS las traducciones en `apps/frontend/src/i18n/index.ts` — NO ficheros JSON
- Al añadir estados nuevos: actualizar todos los idiomas Y los `statusColor` de cada página

## SES Hospedajes

### Endpoint correcto (CRÍTICO)
```
https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion
```
- ⚠️ `/ws/v1/comunicacion` → 404 (incorrecto aunque aparezca en la doc)
- `/ws/comunicacion` → 500 con body vacío = endpoint existe ✅

### Estado (12/03/2026)
- Endpoint actualizado en BD a `/ws/comunicacion`
- Sigue dando 404 con XML completo — causa probable: cuenta no activada en el Ministerio
- **Pendiente**: darse de alta en https://hospedajes.ses.mir.es
- SSL: `rejectUnauthorized: false` ya aplicado
- El XML se comprime con `deflate` — pendiente verificar si el Ministerio lo requiere o espera plano
- El catch en ses.service.ts (~línea 279) no loguea `err.response?.data` — añadir para debugging

## Problemas conocidos

| Problema | Solución |
|----------|----------|
| Checkin 401 | Usar `@Public()` decorator |
| Checkin 404 | Rutas fijas ANTES de `:id` |
| Docker no recarga | `npm run build` + `docker compose build + up -d` |
| Log debug no aparece | Build no incluyó cambios — repetir `npm run build` explícito |
| VITE_API_URL móvil | IP real `192.168.1.123`, no `api:3001` |
| Prisma unknown arg | Verificar nombres en schema.prisma |
| LibreTranslate `no` | Usar `nb` |
| ValidationPipe whitelist | Todos los campos del DTO con decoradores |
| `migrate dev` falla | Usar `prisma db push` en desarrollo |
| Conflicto contenedor | `docker rm -f rentcrm-api && docker compose up -d api` |
| SES 404 | Ver sección SES — endpoint sin `/v1/`, pendiente alta en Ministerio |
| UPDATE BD no persiste | Verificar WHERE con SELECT inmediatamente después |

## Pendiente
Ver `TODO.md`
