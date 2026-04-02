# RentalSuite — Guía para Claude Code
> Actualizado 27/03/2026

## Identidad del proyecto
- **Nombre**: RentalSuite (rebranding pendiente de integrar SVG logo en la app)
- **Repo GitHub**: `grisalenajm/rentcrm-pro`
- **Ramas**: `develop` (trabajo diario) → `main` (producción estable)
- **Tags semánticos**: v1.0.0, v1.1.0... en cada release
- **Commits**: en inglés, SIN Co-Authored-By

## Entorno
- **Repo local**: `/home/rentcrm/rentcrm-pro` (monorepo npm workspaces)
- **Frontend**: `apps/frontend/` → puerto 3000 (Vite — requiere rebuild)
- **API**: `apps/api/` → puerto 3001 (NestJS, prefijo `/api`)
- **DB**: PostgreSQL 16 → `postgresql://rentcrm:<pwd>@localhost:5432/rentcrm`
  - PASSWORD real en `/root/rentcrm-pro/.env` → POSTGRES_PASSWORD
  - Para Prisma CLI usar: `postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm`
  - El .env de apps/api usa Prisma Accelerate (prisma+postgres://) — NO usar para CLI
- **Redis**: `redis://:rentcrm_redis_pass@localhost:6379`
- **LibreTranslate**: `http://libretranslate:5000` (interno Docker)

## Contenedores Docker
rentcrm-api        → NestJS API (puerto 3001)
rentcrm-frontend   → Vite React (puerto 3000)
rentcrm-postgres   → PostgreSQL 16
rentcrm-redis      → Redis 7
rentcrm-translate  → LibreTranslate (puerto 5000)

## Infraestructura
- Corre en contenedor **LXC en Proxmox** (no VM)
- Acceso externo: Nginx con Let's Encrypt → subdominio propio
- Acceso local: HTTP por IP (192.168.1.123) — clipboard API no funciona en HTTP
- HTTPS local: mkcert con CA de Proxmox (en progreso)
- Para entrar al contenedor desde Proxmox: `pct enter 123`

## Comandos esenciales

### Deploy API (SIEMPRE así)
```bash
cd ~/rentcrm-pro
npm run build --workspace=apps/api
docker compose build api && docker compose up -d api
docker logs rentcrm-api --tail=20
```

### Migraciones Prisma (SIEMPRE desde el host)
```bash
cd ~/rentcrm-pro/apps/api
# Obtener password real:
cat ~/rentcrm-pro/.env | grep POSTGRES_PASSWORD
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' npx prisma migrate dev --name nombre
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' npx prisma generate
# Si falla "migration modified":
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' npx prisma db push
```

### Frontend
```bash
docker compose up -d --build frontend
docker logs rentcrm-frontend --tail=5
```

### Git
```bash
# SIEMPRE trabajar en develop — NUNCA commitear directamente a main
cd ~/rentcrm-pro && git add -A && git commit -m "message in English" && git push origin develop

# Merge a main solo cuando el usuario lo pide explícitamente y está verificado:
git checkout main && git merge develop && git push origin main && git checkout develop
```

> **Regla**: todo cambio va a `develop`. `main` = producción estable.
> Claude NO debe hacer commits ni push a `main` salvo instrucción explícita del usuario.

## Modelos Prisma principales
```prisma
model Booking {
  id             String    @id @default(uuid())
  propertyId     String
  clientId       String?   // NULL para reservas importadas de iCal sin cliente
  checkInDate    DateTime  // OJO: checkInDate, NO startDate
  checkOutDate   DateTime  // OJO: checkOutDate, NO endDate
  totalAmount    Float?    // OJO: totalAmount, NO totalPrice
  status         String    @default("created") // created|registered|processed|error|cancelled
  source         String?   // direct|airbnb|booking|vrbo|manual_block
  externalId     String?   // UID del evento iCal (para deduplicación)
  notes          String?
  checkinToken   String?   @unique
  checkinStatus  String?   @default("pending")
  checkinSentAt  DateTime?
  checkinDoneAt  DateTime?
  sesLote        String?
  sesStatus      String?
  sesSentAt      DateTime?
}

model Property {
  paperlessCorrespondentId  Int?    // ID del correspondent en Paperless-ngx
  nrua                      String? // NRUA Comunidad Valenciana, 46 chars
  purchasePrice             Float?
  sesCodigoEstablecimiento  String?
  // sesCodigoEstablecimiento NO va en Organization
}

model BookingPayment {
  id        String   @id @default(uuid())
  bookingId String
  concept   String   // fianza|pago_reserva|pago_final|devolucion_fianza
  amount    Float    // negativo para devoluciones
  date      DateTime
  notes     String?
}

model Expense {
  paperlessDocumentId  Int?    // ID documento Paperless (si creado por webhook)
  paperlessAmount      Float?  // Importe extraído de Paperless
  deductible           Boolean @default(false)
}

model Organization {
  paperlessUrl      String?
  paperlessToken    String?
  paperlessSecret   String?  // Header X-Paperless-Secret para validar webhook
  bankSwift         String?  // Para plantillas de contrato
  bankIban          String?
  bankBeneficiary   String?
  // sesCodigoEstablecimiento NO va aquí → va en Property
}

// Property también tiene: cadastralRef String? (referencia catastral para contratos)
```

## Patrones importantes

### Prisma CLI — credenciales
```bash
# El .env de apps/api/ usa Prisma Accelerate (NO sirve para CLI)
# Usar siempre la password real de ~/rentcrm-pro/.env
cat ~/rentcrm-pro/.env | grep POSTGRES_PASSWORD
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' npx prisma ...
```

### iCal sync → Booking automática
Booking.com/Airbnb iCal → availability_block + Booking (sin cliente)

source: 'airbnb' | 'booking'
status: 'created'
clientId: null
externalId: UID del evento iCal (deduplicación)
checkinToken: generado automáticamente
notes: 'Airbnb' | 'Booking.com'

- Solo se crea Booking si source es airbnb o booking (no manual_block)
- BookingDetail muestra aviso + botón "Copiar enlace check-in" si clientId es null

### Paperless webhook
POST /api/paperless/webhook — @Public()
Header: X-Paperless-Secret: <organization.paperlessSecret>
Parámetros Jinja en Paperless (sintaxis correcta):
{{ document_type }}  {{ correspondent }}  {{ original_filename }}
{{ doc_url }}        {{ created }}
Variables disponibles: correspondent, document_type, original_filename,
doc_url, created, title, added (NO {{ document.pk }})
- Busca Property por nombre normalizado (reemplaza _ por espacio, case-insensitive)
- Extrae document_id de doc_url con regex: `/\/documents\/(\d+)\//`
- Importe en custom_field: formato europeo "EUR1.476,20" → strip no-numérico → quitar puntos de miles → coma a punto → parseFloat = 1476.20
- Proxy PDF: `GET /api/paperless/document/:id?access_token=TOKEN`
  Token temporal (5 min) en Redis: `paperless:doctoken:{uuid}`

### Paperless — configuración Workflow
Trigger: Document updated
Condición: Document type = Factura/Invoice
Condición: Tag NOT includes "to-be-reviewed"
Condición: Tag NOT includes "synced-to-rentalsuite"
Acción: Webhook
URL: {API_URL}/api/paperless/webhook
Header: X-Paperless-Secret: {secret}
JSON: activado
Parámetros:
document_type_name → {{ document_type }}
correspondent_name → {{ correspondent }}
original_file_name → {{ original_filename }}
doc_url            → {{ doc_url }}
created            → {{ created }}
Acción adicional: añadir tag "synced-to-rentalsuite"

### Logs del sistema
Servicio Redis-based para tracking de eventos internos:
- Redis key: `app:logs` (lista LIFO, máx 500 entradas)
- `LogsService.add(level, context, message, details?)` para registrar desde cualquier servicio
- Contextos usados: `ical` | `ses` | `paperless`
- API: `GET /api/logs?limit=&level=&context=` / `DELETE /api/logs` (admin)
- Página `/logs` en el frontend con filtros y botón limpiar

### Pagos de reserva (BookingPayment)
- Conceptos: `fianza` | `pago_reserva` | `pago_final` | `devolucion_fianza`
- `devolucion_fianza`: importe negativo, se auto-rellena con el negativo de la fianza existente
- Sección "Pagos" en BookingDetail: formulario inline + lista + totales (pagado vs totalAmount)
- API: `GET/POST/DELETE /api/bookings/:bookingId/payments`

### HTTPS local con mkcert
```bash
# En el LXC de RentalSuite (pct enter 123 desde Proxmox)
# CA de Proxmox copiada via: pct push 123 /root/.local/share/mkcert/rootCA*.pem
apt install mkcert -y
mkdir -p /root/.local/share/mkcert
# copiar rootCA.pem y rootCA-key.pem
mkcert -install
mkcert 192.168.1.123
# Luego configurar Nginx con los certificados generados
```

### Financials (CRÍTICO)
Ingresos = Booking.totalAmount (status != cancelled) + Financial type='income'
Gastos   = Financial type='expense' + Expense

### Workflow estados de reserva
created → registered | cancelled
registered → processed | error | cancelled
error → registered | cancelled
processed → (final), cancelled → (final)
Colores: created=amber, registered=blue, processed=emerald, error=red, cancelled=slate

### UI tokens centralizados
```typescript
// apps/frontend/src/lib/ui.ts — NUNCA hardcodear clases de botones/inputs/cards
// Tipografía: Inter (Google Fonts)
// Paleta: indigo como acento, fondos #0f0f1a / #1a1a2e
// Componentes: FormField.tsx, DataTable.tsx, KpiCard.tsx
```

### Dockerfile API — lecciones aprendidas
- **Node 22 en builder**: Prisma 7 requiere Node 22+; el stage builder usa `FROM node:22-alpine`
- **`--legacy-peer-deps`**: `npm install` debe llevar este flag por conflicto de peer deps de `@nestjs/mapped-types`
- **`axios` en package.json**: debe estar declarado explícitamente en `apps/api/package.json` (no se hereda del workspace raíz)
- **`prisma.config.ts` al runner**: copiar con `COPY --from=builder /app/apps/api/prisma.config.ts ./prisma.config.ts`; sin él, `prisma migrate deploy` falla en runtime
- **Entrypoint**: `exec node dist/src/main` (con `src/`), NO `dist/main`
- **DATABASE_URL en build time**: `prisma generate` necesita una URL aunque sea dummy: `RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" ./node_modules/.bin/prisma generate --schema=prisma/schema.prisma`
- **URL en Prisma 7**: va en `prisma.config.ts` (campo `datasource.url`), NO en `schema.prisma`

### Docker — Opción C (producción con GHCR)
- **Node 22 en builder**: Prisma 7 requiere Node 22+; usar `FROM node:22-alpine` en el stage builder de la API
- **`--legacy-peer-deps`**: necesario en `npm install` del Dockerfile API por conflicto de peer deps de `@nestjs/mapped-types`
- **`axios` en `apps/api/package.json`**: declararlo explícitamente; no se hereda del workspace raíz dentro del contenedor
- **`prisma.config.ts` al runner**: sin este fichero `prisma migrate deploy` falla en runtime — `COPY --from=builder /app/apps/api/prisma.config.ts ./prisma.config.ts`
- **Entrypoint correcto**: `exec node dist/src/main`, NO `dist/main`
- **DATABASE_URL dummy en build time**: `prisma generate` la necesita aunque sea ficticia; pasarla como variable inline en el `RUN`
- **`certs/mir-ca.pem` como volumen, no en la imagen**: el certificado CA del Ministerio se monta en `docker-compose.prod.yml` con `volumes: - ./certs:/app/certs:ro`; no debe copiarse a la imagen (es un secreto de despliegue)
- **Workflow CI/CD — dos jobs separados**:
  - `build` → `runs-on: ubuntu-latest`: login GHCR, buildx, build+push imágenes API y frontend
  - `deploy` → `runs-on: self-hosted`, `needs: [build]`: `docker compose -f docker-compose.prod.yml pull && up -d` directamente en el servidor; sin SSH externo

### SES Hospedajes
Endpoint producción: `https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion` (SIN /v1/)
Endpoint pruebas:   `https://hospedajes.pre-ses.mir.es/hospedajes-web/ws/comunicacion` (SIN /v1/)
Namespace SOAP correcto: `xmlns:com="http://www.soap.servicios.hospedajes.mir.es/comunicacion"` (API v3.1.3)
  ❌ NUNCA usar `xmlns:com="http://hospedajes.ses.mir.es/"` → causa HTTP 404
SSL: certificado CA del Ministerio (FNMT) cargado desde `certs/mir-ca.pem` — NUNCA rejectUnauthorized: false
sesCodigoEstablecimiento: en Property, NO en Organization
Pendiente: alta en hospedajes.ses.mir.es

Curl de prueba funcional:
```bash
# Requiere credenciales reales y cadena CA del Ministerio en certs/mir-ca.pem
curl -s -u 'USUARIO_WS:PASSWORD_WS' \
  --cacert certs/mir-ca.pem \
  -H 'Content-Type: text/xml; charset=UTF-8' \
  -H 'SOAPAction: comunicacion' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="http://www.soap.servicios.hospedajes.mir.es/comunicacion">
  <soapenv:Header/>
  <soapenv:Body>
    <com:comunicacion>
      <peticion>
        <cabecera>
          <arrendador>CODIGO_ARRENDADOR</arrendador>
          <aplicacion>RentalSuite</aplicacion>
          <tipoOperacion>C</tipoOperacion>
          <tipoComunicacion>PV</tipoComunicacion>
        </cabecera>
        <solicitud></solicitud>
      </peticion>
    </com:comunicacion>
  </soapenv:Body>
</soapenv:Envelope>' \
  https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion
# Respuesta esperada: <codigo>0</codigo> = conexión OK
```

## Deploy desde cero (CRÍTICO)

### Variables de conexión — NO duplicar en .env
DATABASE_URL y REDIS_URL se construyen en docker-compose.yml a partir de las variables
individuales. El .env solo necesita POSTGRES_PASSWORD y REDIS_PASSWORD:
```yaml
# docker-compose.yml / docker-compose.prod.yml — api service
environment:
  DATABASE_URL: "postgresql://rentcrm:${POSTGRES_PASSWORD}@postgres:5432/rentcrm"
  REDIS_URL: "redis://:${REDIS_PASSWORD}@redis:6379"
```
Si alguien añade DATABASE_URL o REDIS_URL al .env, la variable de `environment:` tiene
prioridad — no hay conflicto, pero es redundante y fuente de errores.

### Frontend .env
- `apps/frontend/.env.example` existe en el repo con `VITE_API_URL=https://YOUR_DOMAIN`
- El Dockerfile hace `COPY apps/frontend/.env ./.env` — el fichero debe existir antes del build
- `setup.sh` lo copia automáticamente si no existe
- Para build manual: `cp apps/frontend/.env.example apps/frontend/.env`

### Orden correcto de Prisma en instalación nueva
```bash
# 1. Sincronizar schema (evita desincronización migration/schema)
DATABASE_URL='...' npx prisma db push --schema=apps/api/prisma/schema.prisma
# 2. Aplicar migraciones
DATABASE_URL='...' npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
# 3. Seed inicial (solo primera vez) — ver sección "Primer acceso" más abajo
```

### Primer acceso — crear organización y usuario admin
El seed NO usa datos hardcodeados ni variables del .env permanentes.
Se ejecuta una sola vez pasando los valores inline:

```bash
cd ~/rentcrm-pro
PGPASS=$(grep POSTGRES_PASSWORD .env | cut -d= -f2)

DATABASE_URL="postgresql://rentcrm:${PGPASS}@127.0.0.1:5432/rentcrm" \
SEED_ORG_NAME="Nombre de tu empresa" \
SEED_ADMIN_EMAIL="tu@email.com" \
SEED_ADMIN_PASSWORD="tu-password-segura" \
npx prisma db seed --schema=apps/api/prisma/schema.prisma
```

Variables opcionales del seed:
- SEED_ORG_NIF — NIF/CIF de la organización
- SEED_ORG_ADDRESS — dirección
- SEED_ADMIN_NAME — nombre del usuario (por defecto: "Admin")

El seed crea con upsert: es seguro repetirlo (no duplica datos).
Tras el primer login cambia la password desde Ajustes > Perfil.
El resto de la configuracion (SMTP, Paperless, etc.) se gestiona desde la app.

### Node.js 20 en Ubuntu 24.04
Ubuntu 24.04 instala Node 18 por defecto. Usar nodesource:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
`setup.sh` lo detecta e instala automáticamente.

### Scripts de operación
- `setup.sh` — instalación desde cero (requiere .env ya rellenado)
- `update.sh` — actualización en producción (git pull + build + migrate + restart)

## Problemas conocidos
| Problema | Solución |
|----------|----------|
| Prisma CLI falla auth | Usar pwd de ~/rentcrm-pro/.env, no la del apps/api/.env |
| Clipboard no funciona | Solo funciona en HTTPS — usar dominio externo o mkcert local |
| Paperless body vacío | Activar parámetros con sintaxis {{ variable }} |
| Paperless IP bloqueada | PAPERLESS_WEBHOOKS_ALLOW_INTERNAL_REQUESTS=true |
| Paperless `document` undefined | Usar {{ correspondent }}, no {{ document.correspondent }} |
| iCal bloque no crea Booking | Borrar availability_block y re-sincronizar |
| Booking sin cliente | Normal para reservas iCal — copiar enlace checkin |
| Docker no recarga | npm run build + docker compose build + up -d |
| SES 404 | Endpoint sin /v1/, pendiente alta Ministerio |

## Pendiente
Ver TODO.md
