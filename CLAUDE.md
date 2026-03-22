# RentalSuite — Guía para Claude Code
> Antes llamado RentCRM Pro. Documento actualizado 17/03/2026.

## Identidad del proyecto
- **Nombre**: RentalSuite (rebranding pendiente de integrar SVG logo en la app)
- **Repo GitHub**: `grisalenajm/rentcrm-pro`
- **Ramas**: `develop` (trabajo diario) → `main` (producción estable, merge cuando está probado)
- **Tags semánticos**: v1.0.0, v1.1.0... en cada release

## Entorno
- **Repo local**: `/home/rentcrm/rentcrm-pro` (monorepo npm workspaces)
- **Frontend**: `apps/frontend/` → puerto 3000 (Vite — **requiere rebuild** para ver cambios)
- **API**: `apps/api/` → puerto 3001 (NestJS, prefijo `/api`)
- **DB**: PostgreSQL → `postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm`
- **Redis**: `redis://:rentcrm_redis_pass@localhost:6379`
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
DATABASE_URL="postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm" npx prisma migrate dev --name nombre-migracion
DATABASE_URL="postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm" npx prisma generate
# Si falla "migration modified":
DATABASE_URL="postgresql://rentcrm:c5ede5edf3e89584e63cd4b1d1e4aced@localhost:5432/rentcrm" npx prisma db push
```

### Frontend (requiere rebuild — NO hay hot reload real en el contenedor)
```bash
docker compose build frontend && docker compose up -d frontend
docker logs rentcrm-frontend --tail=5
```

### Git
```bash
cd ~/rentcrm-pro && git add -A && git commit -m "message in English (public repo)" && git push origin develop
```
> Los commits NO llevan Co-Authored-By.
> Merge a main solo cuando el usuario confirma que está probado y estable.

## Estructura de archivos clave
```
rentcrm-pro/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── auth/                  ← login, JWT, OTP/2FA
│   │       ├── bookings/
│   │       ├── clients/
│   │       ├── properties/
│   │       ├── expenses/
│   │       ├── recurring-expenses/
│   │       ├── financials/
│   │       ├── excel/
│   │       ├── organization/
│   │       ├── paperless/
│   │       ├── translation/
│   │       └── prisma/prisma.service.ts
│   └── frontend/
│       └── src/
│           ├── context/AuthContext.tsx ← JWT, idle detection, 2FA flow
│           ├── data/countries.ts
│           ├── components/
│           │   ├── Layout.tsx
│           │   ├── ExcelButtons.tsx
│           │   └── BookingStatusWorkflow.tsx
│           └── pages/
│               ├── Dashboard.tsx
│               ├── Bookings.tsx
│               ├── BookingDetail.tsx
│               ├── Clients.tsx
│               ├── ClientDetail.tsx
│               ├── ClientEdit.tsx
│               ├── Properties.tsx
│               ├── PropertyDetail.tsx
│               ├── PropertyEdit.tsx
│               ├── Financials.tsx
│               ├── PropertyFinancialDetail.tsx
│               ├── OccupancyCalendar.tsx
│               ├── Contracts.tsx        ← tabs Contratos + Plantillas
│               ├── Police.tsx           ← "En desarrollo"
│               ├── Settings.tsx
│               ├── Profile.tsx          ← perfil, cambio pwd, 2FA
│               └── CheckinPage.tsx      ← pública /checkin/:token
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
  province                 String?
  postalCode               String? @map("postal_code")
  country                  String? @db.VarChar(5)
  photo                    String?
  icalUrl                  String?
  purchasePrice            Float?
  sesCodigoEstablecimiento String?
  nrua                     String?   // NRUA Comunidad Valenciana, 46 chars
  paperlessCorrespondentId Int?      // ID del correspondent en Paperless-ngx
  organizationId           String
  notes                    String?
}

model Expense {
  id                   String   @id @default(uuid())
  propertyId           String
  date                 DateTime
  amount               Float
  type                 String   // tasas|agua|luz|internet|limpieza|otros
  deductible           Boolean  @default(false)
  notes                String?
  organizationId       String
  paperlessDocumentId  Int?     // ID del documento en Paperless-ngx (si fue creado por webhook)
  paperlessAmount      Float?   // Importe extraído del documento Paperless
}

model RecurringExpense {
  id             String    @id @default(uuid())
  propertyId     String
  organizationId String
  type           String
  amount         Float
  deductible     Boolean   @default(false)
  frequency      String    // monthly|quarterly|yearly
  dayOfMonth     Int       // 1-28
  notes          String?
  active         Boolean   @default(true)
  nextRunDate    DateTime
  lastRunDate    DateTime?
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
  sesUsuarioWs          String?
  sesPasswordWs         String?
  sesCodigoArrendador   String?
  sesEndpoint           String?
  paperlessUrl          String?
  paperlessToken        String?
  paperlessDocTypeId    Int?
  paperlessSecret       String?   // Secreto para validar el webhook (X-Paperless-Secret)
  // sesCodigoEstablecimiento NO va aquí, va en Property
}

model User {
  id             String    @id @default(uuid())
  email          String    @unique
  password       String
  role           String    // admin|gestor|owner|viewer
  otpSecret      String?
  otpEnabled     Boolean   @default(false)
  otpVerifiedAt  DateTime?
  organizationId String
}

model PropertyRules {
  id                 String   @id @default(uuid())
  propertyId         String   @unique
  organizationId     String
  baseLanguage       String   @default("es")
  baseContent        String   @db.Text
  translations       Json     @default("{}")
  translationsEdited Json     @default("[]")
  updatedAt          DateTime @updatedAt
}
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

### Autenticación — flujo 2FA
```
Sin 2FA:  POST /auth/login → { access_token, user }
Con 2FA:  POST /auth/login → { requiresOtp: true, tempToken }
          POST /auth/otp/validate { tempToken, otpToken } → { access_token, user }
Gestión:  POST /users/otp/setup → /otp/verify → /otp/disable
```
- 2FA es opcional por usuario, se configura en Profile.tsx
- `tempToken` es un JWT `{ sub, type:'otp-pending' }` con expiración de 5 min

### Sesión idle
```typescript
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
// 401 en cualquier llamada → mensaje "Sesión expirada" → redirect login
// 30 min sin actividad → aviso → 2 min → logout automático
```

### Financials — fuente de ingresos (CRÍTICO)
```
Ingresos = Booking.totalAmount (status != cancelled) + Financial type='income'
Gastos   = Financial type='expense' + Expense
```
- Usar `/api/financials/combined-summary` para totales que sumen ambas fuentes
- NO usar solo `/api/financials` para calcular ingresos totales

### Endpoint reporte financiero por propiedad
```typescript
GET /api/financials/property/:propertyId/report?year=YYYY
// ⚠️ ANTES de /:id en el controlador
```

### Dashboard — estructura
- KPIs SIEMPRE encima del selector de gráfico
- ROI = (beneficio anual / purchasePrice) * 100; mostrar "—" si no hay purchasePrice
- Pestaña Negocio: selector mensual/trimestral/anual con navegación de periodos

### PropertyFinancialDetail
- KPIs anuales ENCIMA del selector de periodo
- Selector de periodo afecta solo al gráfico

### Paperless-ngx
```typescript
// Tags: resolver nombres → IDs numéricos (resolveTagId)
// Error en Paperless NO bloquea el flujo principal
// SMTP y Paperless config: siempre desde Organization en BD
```

### Paperless webhook
```
POST /api/paperless/webhook  ← @Public(), sin JWT
Header: X-Paperless-Secret: <organization.paperlessSecret>

Flujo:
1. Valida secret (si está configurado en Organization)
2. Filtra: document_type_name === "Factura"
3. Busca Property por paperlessCorrespondentId === body.correspondent
4. Llama getDocument() para obtener metadatos completos
5. Infiere type desde tags: agua|luz|internet|limpieza|tasas → "otros"
6. Extrae importe de custom_fields (campo con "importe" en el nombre)
7. Crea Expense con paperlessDocumentId + enlace preview en notes

URL a configurar en Paperless: {FRONTEND_URL}/api/paperless/webhook
```

### Contratos — rutas públicas
```typescript
@Public() GET/POST /contracts/sign/:token
@Public() GET      /contracts/view/:token
// URLs públicas: siempre signToken, NUNCA el ID
// Email: {FRONTEND_URL}/contracts/sign/{signToken}
```

### SMTP — regla crítica
```typescript
// SIEMPRE desde Organization en BD
const org = await this.prisma.organization.findFirst()
// Si smtpHost no definido: lanzar error, NO marcar como enviado
```

### Gastos recurrentes
```typescript
@Cron('0 8 * * *') // genera Expense real + email
// dayOfMonth máximo 28
// RecurringExpense es plantilla, Expense es el registro contable
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

### Frontend — routing API
- `api.ts` usa `baseURL: '/api'` relativo → Vite proxy redirige a `http://api:3001`
- `CheckinPage.tsx` usa `VITE_API_URL + '/api'` directo (página pública)
- NO usar `http://api:3001` desde el navegador

### i18n
- TODAS las traducciones en `apps/frontend/src/i18n/index.ts` — NO ficheros JSON
- Al añadir estados nuevos: actualizar todos los idiomas Y los `statusColor` de cada página

### Filtros y ordenación de tablas
- Se hacen en el **frontend** sobre los datos ya cargados (no query params al backend)
- Patrón: `useState` para filtro texto + columna/dirección ordenación, `useMemo` para derivar lista filtrada

### Navegación entre registros
- Pasar `{ state: { ids: string[], index: number } }` al navegar al detalle desde el listado
- En el detalle: `const navState = useLocation().state` → flechas ← → con contador
- Sin state (acceso directo por URL) → no se muestran flechas

### Edición masiva (bulk)
- Disponible en Bookings, Clients y Expenses
- Endpoints bulk con `@SkipThrottle()` para evitar rate limit
- Llamadas secuenciales con delay 300ms para evitar ThrottlerException

### PropertyRules — traducciones
- `translations` es un JSON `{ "en": "...", "fr": "..." }` con los 10 idiomas como clave
- `translationsEdited` es un array de códigos de idioma editados manualmente
- El endpoint `POST /api/properties/:id/rules/translate` respeta `translationsEdited`
- En checkin: si existe `translations[lang]` → se usa; si no → se devuelve `baseContent`

## SES Hospedajes

### Endpoint correcto (CRÍTICO)
```
https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion
```
- ⚠️ `/ws/v1/comunicacion` → 404 (incorrecto)
- `/ws/comunicacion` → 500 con body vacío = endpoint existe ✅

### Estado (17/03/2026)
- Endpoint actualizado en BD a `/ws/comunicacion`
- Sigue dando 404 con XML completo — causa probable: cuenta no activada en el Ministerio
- **Pendiente**: darse de alta en https://hospedajes.ses.mir.es
- SSL: `rejectUnauthorized: false` ya aplicado
- El XML se comprime con `deflate` — pendiente verificar si el Ministerio lo requiere o espera plano
- El catch en ses.service.ts (~línea 279) no loguea `err.response?.data` — añadir para debugging

### Exportación N2 (NRUA)
- Endpoint: `GET /api/excel/export/nrua?year=YYYY&propertyId=XXX`
- Un CSV por propiedad; descarga secuencial si se seleccionan varias
- Solo propiedades con `nrua` definido (devuelve 400 si no hay NRUA)
- Formato fechas: `dd-mm-yyyy`, separador: `;`, finalidad: constante `1`
- `huespedes`: `BookingGuestSes.count` si existen, si no `1`
- Frontend: componente `NruaExport.tsx` en Properties.tsx (checkboxes + selector año)

## Problemas conocidos

| Problema | Solución |
|----------|----------|
| Checkin/contrato 401 | `@Public()` + ruta fija ANTES de `:id` |
| Docker no recarga | `npm run build` + `docker compose build + up -d` |
| Log debug no aparece | Build no incluyó cambios — repetir `npm run build` explícito |
| Prisma unknown arg | Verificar nombres en schema.prisma |
| `migrate dev` falla | Usar `prisma db push` en desarrollo |
| Conflicto contenedor | `docker rm -f rentcrm-api && docker compose up -d api` |
| SES 404 | Endpoint sin `/v1/`, pendiente alta en Ministerio |
| UPDATE BD no persiste | Verificar WHERE con SELECT inmediatamente después |
| ClientDetail sin reservas | Usar `GET /api/bookings?clientId=` |
| Email contrato no llega | SMTP desde Organization en BD |
| Paperless 400 tags | resolveTagId: nombres → IDs numéricos |
| Dashboard sin ingresos | Sumar bookings.totalAmount + financials income |
| Estado 'pending' en reserva | No existe, el correcto es 'created' |
| Edición masiva throttle | Llamadas secuenciales con delay 300ms |
| LibreTranslate `no` | Usar `nb` |
| ValidationPipe whitelist | Todos los campos del DTO con decoradores |

## Pendiente
Ver `TODO.md`
