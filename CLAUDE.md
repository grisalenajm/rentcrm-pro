# RentalSuite — Guía para Claude Code
> Actualizado 05/04/2026

## Identidad del proyecto
- **Nombre**: RentalSuite (SVG logo pendiente de integrar)
- **Repo**: `grisalenajm/rentcrm-pro` — ramas `develop` → `main`
- **Commits**: en inglés, SIN Co-Authored-By

## Entorno
- **Repo local**: `/home/rentcrm/rentcrm-pro` (monorepo npm workspaces)
- **Frontend**: `apps/frontend/` → puerto 3000 (Vite — requiere rebuild siempre)
- **API**: `apps/api/` → puerto 3001 (NestJS, prefijo `/api`)
- **DB**: PostgreSQL 16 → `postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm`
  - Password real en `~/rentcrm-pro/.env` → `POSTGRES_PASSWORD`
  - El `.env` de `apps/api/` usa Prisma Accelerate — NO sirve para CLI
- **Redis**: `redis://:rentcrm_redis_pass@localhost:6379`
- **LibreTranslate**: `http://libretranslate:5000` (interno Docker)
- **LXC Proxmox**: acceder con `pct enter 123`

## Comandos esenciales

### Deploy API
```bash
cd ~/rentcrm-pro
npm run build --workspace=apps/api
docker compose build api && docker compose up -d api
docker logs rentcrm-api --tail=20
```

### Deploy Frontend
```bash
docker compose up -d --build frontend
docker logs rentcrm-frontend --tail=5
```

### Migraciones Prisma (SIEMPRE desde el host)
```bash
cd ~/rentcrm-pro/apps/api
cat ~/rentcrm-pro/.env | grep POSTGRES_PASSWORD
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' npx prisma migrate dev --name nombre
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' npx prisma generate
# Si falla "migration modified":
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' npx prisma db push
```

### Git
```bash
git add -A && git commit -m "message in English" && git push origin develop
```

## Modelos Prisma principales
```prisma
model Booking {
  checkInDate    DateTime  // NO startDate
  checkOutDate   DateTime  // NO endDate
  totalAmount    Float?    // NO totalPrice
  status         String    @default("created") // created|registered|processed|error|cancelled
  source         String?   // direct|airbnb|booking|vrbo|manual_block
  externalId     String?   // UID iCal (deduplicación)
  clientId       String?   // NULL para reservas iCal sin cliente
}

model Property {
  sesCodigoEstablecimiento  String? // NO va en Organization
  paperlessCorrespondentId  Int?
  nrua                      String? // 46 chars, Comunidad Valenciana
  purchasePrice             Float?
  cadastralRef              String?
}

model Expense {
  deductible           Boolean @default(false) // con t, NO deducible
  paperlessDocumentId  Int?
  paperlessAmount      Float?
}

model Organization {
  paperlessUrl      String?
  paperlessToken    String?
  paperlessSecret   String?
  bankSwift         String?
  bankIban          String?
  bankBeneficiary   String?
}

model BookingPayment {
  concept   String   // fianza|pago_reserva|pago_final|devolucion_fianza
  amount    Float    // negativo para devoluciones
}

model Material {
  id            String   @id @default(uuid())
  name          String
  description   String?
  type          String   // limpieza|baño|regalos|otros
  unit          String   // ud|kg|g|l|ml|m|m2|pack|caja|rollo|paquete|botella|unidad|docena|bolsa|tubo|bote
  barcode       String   @unique // auto-generado MAT-00000001 (Code128)
  standardPrice Float
  minStock      Float    @default(0)
  isActive      Boolean  @default(true)
}

model StockMovement {
  id         String   @id @default(uuid())
  propertyId String
  materialId String
  type       String   // entrada|salida|recuento
  quantity   Float    // positivo entrada/recuento ajuste, negativo salida
  unitPrice  Float    // último precio de entrada para salidas, introducido para entradas
  notes      String?
  userId     String
  createdAt  DateTime @default(now())
}
```

## Roles
`admin` > `gestor` > `owner` > `inventario` (solo módulo inventarios) > viewer (solo lectura)

| Rol | Acceso |
|-----|--------|
| admin | Acceso total a toda la aplicación |
| gestor | Acceso total excepto gestión de usuarios |
| owner | Acceso de lectura + reservas propias |
| viewer | Solo lectura en todos los módulos |
| inventario | **Solo módulo `/inventory`**. Puede ver Master Data, registrar movimientos de stock y hacer recuentos. NO puede crear ni editar materiales (solo admin y gestor). Sin acceso al resto de la aplicación. |

## Patrones críticos

### Nombres de campos
- `Booking`: `checkInDate`, `checkOutDate`, `totalAmount`, `externalId`
- `Booking.status`: `created|registered|processed|error|cancelled`
- `Booking.source`: `direct|airbnb|booking|vrbo|manual_block`
- `Expense`: `deductible` (con t), `paperlessDocumentId`, `paperlessAmount`
- `sesCodigoEstablecimiento`: en `Property`, NO en `Organization`

### Rutas NestJS
- Rutas fijas SIEMPRE antes de `:id`
- Rutas públicas: usar `@Public()` decorator
- Endpoints bulk: añadir `@SkipThrottle()`

### Frontend
- `api.ts` usa `baseURL: '/api'` relativo — Vite proxy redirige a `http://api:3001`
- Acceso externo desde móvil: `http://192.168.1.123:3001`
- Tokens UI centralizados en `src/lib/ui.ts` — NUNCA hardcodear clases
- Países: `WORLD_COUNTRIES` desde `src/data/countries.ts`
- Arrays async → `useMemo` dentro del componente
- Clipboard API solo funciona en HTTPS

### Financials
Ingresos = Booking.totalAmount (status != cancelled, source != manual_block) + Financial type='income'
Gastos   = Financial type='expense' + Expense
Ocupación: usar Set para deduplicar rangos solapados

### iCal → Booking
- Solo crea `Booking` si source es `airbnb` o `booking` (no `manual_block`)
- `manual_block`: NO borrar — toggle visibilidad en UI
- `clientId: null` para reservas iCal — mostrar aviso + botón "Copiar enlace check-in"

### Paperless webhook
- `POST /api/paperless/webhook` — `@Public()`, valida `X-Paperless-Secret`
- Extrae `document_id` de `doc_url` con regex `/\/documents\/(\d+)\//`
- Parser importe europeo:
```ts
  const raw = String(val).replace(/[^0-9.,]/g, '');
  const cleaned = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  // EUR1.476,20 → 1476.20
```
- Busca Property por `correspondent_name` normalizado (minúsculas, `_` → espacio)
- Variables Jinja: `{{ correspondent }}` (NO `{{ document.correspondent }}`)

### SES Hospedajes
- Endpoint: `https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion` (SIN `/v1/`)
- SSL: `rejectUnauthorized: false` solo en esa llamada axios

### Logs del sistema
- Redis key: `app:logs` (LIFO, máx 500). `LogsService.add(level, context, message, details?)`
- Contextos: `ical` | `ses` | `paperless`

### Workflow estados reserva
created → registered | cancelled
registered → processed | error | cancelled
error → registered | cancelled
Colores: created=amber, registered=blue, processed=emerald, error=red, cancelled=slate

## Errores comunes

| Error | Correcto |
|-------|----------|
| `booking.startDate/endDate/totalPrice` | `checkInDate/checkOutDate/totalAmount` |
| `docker compose restart` | `npm run build` + `docker compose build` + `up -d` |
| Prisma CLI desde el contenedor | Desde el host con `DATABASE_URL` explícita |
| `deducible` en Expense | `deductible` (con t) |
| `sesCodigoEstablecimiento` en Organization | Va en Property |
| Quitar `@UseGuards()` para ruta pública | Usar `@Public()` |
| Ruta `/:id` antes de ruta fija | Rutas fijas SIEMPRE primero |
| `http://api:3001` desde el navegador | `/api` o IP directa |
| Traducciones en JSON separados | Todo en `apps/frontend/src/i18n/index.ts` |
| Endpoint SES con `/v1/` | Sin `/v1/` |
| Bulk sin `@SkipThrottle()` | Añadir `@SkipThrottle()` en métodos bulk |
| `{{ document.correspondent }}` en Jinja | `{{ correspondent }}` |
| Parser importe con `.replace(',', '.')` directo | Quitar puntos de miles primero |

## Problemas conocidos

| Problema | Solución |
|----------|----------|
| Prisma CLI falla auth | Usar pwd de `~/rentcrm-pro/.env`, no la de `apps/api/.env` |
| Clipboard no funciona | Solo HTTPS — usar dominio externo o mkcert local |
| Paperless IP bloqueada | `PAPERLESS_WEBHOOKS_ALLOW_INTERNAL_REQUESTS=true` |
| Docker no recarga código | `npm run build` + `docker compose build` + `up -d` |
| SES 404 | Endpoint sin `/v1/`, pendiente alta Ministerio |
| UPDATE en BD no persiste | Usar `WHERE campo LIKE '%valor%'` y verificar con SELECT |
| Catch sin info útil | Loguear siempre `err.message` Y `err.response?.data` |
| Stock negativo bloqueado | Backend rechaza salidas si quantity > stockActual con BadRequestException |

## Pendiente
Ver `TODO.md`
