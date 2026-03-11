# RentCRM Pro — Guía para Claude Code

## Entorno
- **Repo**: `/home/rentcrm/rentcrm-pro` (monorepo npm workspaces)
- **Frontend**: `apps/frontend/` → puerto 3000 (Vite dev server, hot reload)
- **API**: `apps/api/` → puerto 3001 (NestJS, prefijo `/api`)
- **DB**: PostgreSQL → `postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm`
- **Redis**: `redis://:rentcrm_redis_pass@localhost:6379`
- **LibreTranslate**: `http://localhost:5000` (externo) / `http://libretranslate:5000` (interno Docker)

## Contenedores Docker
rentcrm-api        → NestJS API (puerto 3001)
rentcrm-frontend   → Vite React (puerto 3000)
rentcrm-postgres   → PostgreSQL 15
rentcrm-redis      → Redis 7
rentcrm-translate  → LibreTranslate (puerto 5000)

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
DATABASE_URL="postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm" npx prisma migrate dev --name nombre-migracion
DATABASE_URL="postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm" npx prisma generate
# Si falla "migration modified": usar db push en desarrollo
DATABASE_URL="postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm" npx prisma db push
```

### Frontend (hot reload automático, no necesita rebuild)
```bash
docker logs rentcrm-frontend --tail=5
```

### Git
```bash
cd ~/rentcrm-pro && git add -A && git commit -m "mensaje" && git push origin main
```

## Estructura de archivos clave
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
│   │       │   └── dto/
│   │       │       ├── create-booking.dto.ts
│   │       │       └── update-booking.dto.ts
│   │       ├── clients/
│   │       ├── properties/
│   │       ├── expenses/              ← CRUD gastos por propiedad
│   │       ├── excel/                 ← exportar/importar Excel
│   │       ├── translation/
│   │       │   ├── translation.service.ts  ← caché + precalentamiento
│   │       │   └── translation.module.ts
│   │       └── prisma/
│   │           └── prisma.service.ts
│   └── frontend/
│       └── src/
│           ├── main.tsx
│           ├── App.tsx                ← rutas React Router
│           ├── context/
│           │   └── AuthContext.tsx    ← JWT en memoria (no localStorage)
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
│               └── CheckinPage.tsx    ← página PÚBLICA /checkin/:token

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
  street         String?             // ← dirección estructurada
  city           String?
  postalCode     String?   @map("postal_code")
  province       String?
  country        String?   @db.VarChar(5)  // código ISO: ES, FR, DE...
  notes          String?
  language       String?   @default("es")
  organizationId String
}

model Property {
  id      String  @id @default(uuid())
  name    String
  address String?
  city    String?
  photo   String? // base64
  icalUrl String?
  organizationId String
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
  street     String?             // ← dirección estructurada
  city       String?
  postalCode String?   @map("postal_code")
  province   String?
  country    String?
  booking    Booking   @relation(...)
}
```

## Variables de entorno clave (.env en apps/api/)
DATABASE_URL=postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@postgres:5432/rentcrm
REDIS_URL=redis://:rentcrm_redis_pass@redis:6379
JWT_SECRET=...
FRONTEND_URL=http://192.168.1.123:3000
LIBRETRANSLATE_URL=http://libretranslate:5000
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

## Patrones importantes

### Rutas públicas (sin JWT)
```typescript
@Public()
@Get('checkin/:token')
getCheckin() {}
// IMPORTANTE: rutas con parámetro fijo ANTES de :id en el controlador
```

### Validación DTO con whitelist
```typescript
// main.ts tiene: app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
// Todos los campos en DTOs deben tener decoradores @IsString(), @IsOptional(), etc.
```

### Prisma — nombres de campos Booking
```typescript
// IMPORTANTE: los campos de Booking usan checkInDate/checkOutDate/totalAmount
// NO startDate/endDate/totalPrice (nombres legacy ya eliminados)
// Siempre verificar: grep "fieldName" apps/api/prisma/schema.prisma
prisma.booking.update({ data: { checkInDate: new Date(data.checkInDate), totalAmount: data.totalAmount } })
```

### Workflow estados de reserva
```
created → registered → processed (flujo normal)
created → cancelled
registered → error → registered (reintento)
registered → cancelled
error → processed, cancelled
```
- `PATCH /bookings/:id/status` con body `{ status }` — valida transiciones en backend
- `updateStatusOnCheckinComplete()` — auto: created/error → registered al completar checkin
- `updateStatusOnSesSent(success)` — auto: registered/error → processed o → error al enviar SES
- Colores: created=amber, registered=blue, processed=emerald, error=red, cancelled=slate

### TranslationService
```typescript
// Caché en memoria + precalentamiento al arrancar (onModuleInit)
// 10 idiomas: es, en, fr, de, it, pt, nl, da, nb, sv
// Fallback: devuelve texto original si LibreTranslate no responde
await this.translationService.translateMany([...textos], lang);
```

### Frontend — VITE_API_URL
VITE_API_URL=http://192.168.1.123:3001  ← IP local, accesible desde móvil
// NO usar http://api:3001 (no accesible desde navegador externo)

### Responsive — breakpoints
Sin prefijo = móvil primero
md: = 768px = desktop

### Patrón tabla→tarjetas móvil
```jsx
<div className="hidden md:block"><table>...</table></div>
<div className="md:hidden space-y-3">{items.map(i => <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">...</div>)}</div>
```

### Patrón modal fullscreen móvil
```jsx
<div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
  <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[95vh] overflow-y-auto p-6">
```

## Problemas conocidos y soluciones

| Problema | Solución |
|----------|----------|
| Checkin 401 | Usar `@Public()` decorator, no `@UseGuards()` vacío |
| Checkin 404 | Rutas fijas ANTES de `:id` en el controlador |
| Docker no recarga código | Siempre `build + up -d`, nunca solo `restart` |
| VITE_API_URL móvil | Usar IP real `192.168.1.123`, no `api:3001` |
| Prisma unknown arg | Verificar nombres exactos en schema.prisma |
| LibreTranslate `no` | Usar `nb` (noruego bokmål) |
| ValidationPipe whitelist | Añadir TODOS los campos al DTO con decoradores |
| `migrate dev` falla "migration modified" | Usar `prisma db push` en desarrollo (ver sección Migraciones) |
| Prisma `DATABASE_URL` no resuelve en host | Pasar la URL explícita con variable de entorno al comando |

## Pendiente (priorizado)
- [x] WORKFLOW ESTADOS RESERVA: created→registered→processed/error/cancelled. Componente BookingStatusWorkflow. Auto-transiciones en checkin y SES.
- [x] DIRECCIÓN ESTRUCTURADA: street/city/postalCode/province/country en Client y BookingGuestSes. Formulario en Clients.tsx. Prefill en checkin online. Checkbox "misma dirección" para huéspedes.
- [ ] MEJORAS FLUJO RESERVA: solo nombre al crear reserva, idioma por nacionalidad del cliente
- [ ] DOCUMENTOS Y REGLAS DE LA CASA: por propiedad, traducción automática al idioma del cliente
- [ ] PÁGINA PARTES SES: historial de envíos con navegación
- [ ] CONSULTA ESTADO LOTE SES: confirmación asíncrona Ministerio
- [ ] NOTIFICACIÓN EMAIL SES: cuando confirma/rechaza
- [ ] DEPLOY PRODUCCIÓN: Nginx, VITE_API_URL relativo, docker-compose.prod.yml
- [ ] VERSIONADO API: prefijo /api/v1/
