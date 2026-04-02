<div align="center">

# RentalSuite

**Vacation rental CRM — SES compliance · digital contracts · automated check-in**

[![Version](https://img.shields.io/badge/version-v1.3.0-blue.svg)](https://github.com/your-org/rentalsuite/releases)
[![License](https://img.shields.io/badge/license-GPL--3.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-20%2B-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-compose-blue.svg)](https://docs.docker.com/compose/)

</div>

---

RentalSuite is an open-source CRM for short-term rental managers. It covers the
full guest lifecycle — from booking and contract signing to online check-in,
automated translations and government compliance reporting (SES Hospedajes,
Spain's Ministry of Interior traveller registration system).

## ✨ Key Features

| Area | Features |
|------|----------|
| **Bookings** | Full CRUD, status workflow, overlapping-date validation, bulk edit, source tracking (Airbnb, Booking, direct…) |
| **Check-in** | Tokenised public page, multilingual house rules (10 languages), one-time-use link |
| **Contracts** | Template engine, digital signature canvas (tenant + landlord), public signing link, Paperless-ngx upload |
| **SES Compliance** | SOAP submission to Spain's Ministry of Interior, XML/PDF download, per-property codes |
| **Financials** | Income/expense tracking, recurring expenses with cron, property ROI reports, deductible flag |
| **Paperless-ngx** | Auto-upload signed contracts, webhook to auto-create expenses from invoices, correspondent per property |
| **Dashboard** | 4-tab analytics (recharts): KPIs, business metrics, client stats, compliance summary |
| **iCal Sync** | Import feeds from Airbnb/Booking.com (cron every 6 h), export `.ics` |
| **Excel** | Import/export clients, bookings, expenses, properties |
| **Translations** | Self-hosted LibreTranslate, Redis cache, 10 languages |
| **Multi-user** | Roles: `admin`, `gestor`, `owner`, `viewer` |
| **2FA / OTP** | TOTP authentication (Google Authenticator / Authy), per-user activation, QR setup, secure temp-token login flow |

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS + Recharts |
| Backend | NestJS + TypeScript + Prisma ORM |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Translations | LibreTranslate (self-hosted, 10 languages) |
| Auth | JWT (access + refresh tokens) + role guards + TOTP 2FA (otplib) |
| Infra | Docker Compose + Nginx reverse proxy |

---

## 🇬🇧 English

### Requirements

- **Docker** ≥ 24 with the Compose plugin (`docker compose version`)
- A Linux server with ports 80/443 open (for Nginx + Let's Encrypt)
- No Node.js required on the server — images are pre-built via GitHub Actions
- An **SMTP account** (optional, needed for email features)

### Quick Start (local development, 5 min)

> Node.js 20+ required locally. On Ubuntu 24.04 install via NodeSource:
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
> sudo apt-get install -y nodejs
> ```

```bash
git clone https://github.com/grisalenajm/rentcrm-pro.git
cd rentcrm-pro

# Infrastructure
docker compose up -d postgres redis

# Dependencies
npm install

# Database
PGPASS=your_local_password
DATABASE_URL="postgresql://rentcrm:${PGPASS}@127.0.0.1:5432/rentcrm" \
  npx prisma migrate dev --schema=apps/api/prisma/schema.prisma

# Run API (terminal 1)
npm run dev --workspace=apps/api

# Run frontend (terminal 2)
npm run dev --workspace=apps/frontend
```

Frontend: http://localhost:5173 — API: http://localhost:3001

### Full Installation (production)

#### Requirements

- A Linux server with Docker ≥ 24 and the Compose plugin (`docker compose version`)
- Ports 80/443 open (for Nginx + Let's Encrypt)
- No Node.js required on the server

#### Step 1 — Download compose file and environment template

```bash
mkdir rentalsuite && cd rentalsuite

curl -O https://raw.githubusercontent.com/grisalenajm/rentcrm-pro/main/docker-compose.prod.yml
curl -O https://raw.githubusercontent.com/grisalenajm/rentcrm-pro/main/.env.example
```

#### Step 2 — Configure environment variables

```bash
cp .env.example .env
nano .env
```

Minimum required values (`DATABASE_URL` and `REDIS_URL` are auto-built by docker-compose):

```bash
POSTGRES_USER=rentcrm
POSTGRES_DB=rentcrm
POSTGRES_PASSWORD=           # openssl rand -hex 32
REDIS_PASSWORD=              # openssl rand -hex 32
JWT_SECRET=                  # openssl rand -hex 64
JWT_REFRESH_SECRET=          # openssl rand -hex 64
FRONTEND_URL=https://your-domain.com
```

#### Step 3 — Start services

If you have containers from a previous installation with conflicting names, remove them first:

```bash
docker compose -f docker-compose.prod.yml down
# or individually: docker rm -f rentcrm-api rentcrm-frontend rentcrm-postgres rentcrm-redis
```

Start all services (pulls pre-built images from GHCR):

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps   # all should be Up
docker logs rentcrm-api --tail=30              # wait until API is ready
```

#### Step 4 — Run database migrations

Migrations do **not** run automatically. Run them once after the first `up -d`:

```bash
docker exec -it rentcrm-api sh -c "node_modules/.bin/prisma migrate deploy"
docker compose -f docker-compose.prod.yml restart api
```

Expected output: `All migrations have been successfully applied.`

#### Step 5 — Create your organization and admin user

No Node.js needed on the server — the seed runs inside the container:

```bash
docker exec -it rentcrm-api sh -c "
  SEED_ORG_NAME='Your Company Name' \
  SEED_ADMIN_EMAIL='you@example.com' \
  SEED_ADMIN_PASSWORD='your-secure-password' \
  node dist/prisma/seed.js
"
```

Optional variables: `SEED_ORG_NIF`, `SEED_ORG_ADDRESS`, `SEED_ADMIN_NAME`.
The seed uses upsert — safe to re-run (no duplicate data).

**After first login:** change your password from Settings > Profile.

#### Step 6 — Configure Nginx + SSL

See the Nginx + SSL section below.

### Post-installation Configuration

Once the app is running, complete the setup from **Settings** in the web UI:

**SMTP (email features)**
- Go to Settings → Organization → SMTP
- Fill in host, port, user, password and sender address
- Required for: contract emails, check-in links, recurring expense notifications

**SES Hospedajes** *(beta — Spain's Ministry of Interior traveller registration)*
- Go to Settings → Integrations → SES Hospedajes
- Enter your SES credentials (`sesUsuarioWs`, `sesPasswordWs`) and property codes (`sesCodigoEstablecimiento` per property)
- Select environment: `pruebas` (testing) or `produccion`
- **Note:** SES requires a valid CA certificate from FNMT (Spain's national CA). See [`docs/SES_INTEGRACION.md`](docs/SES_INTEGRACION.md) for full setup instructions including certificate installation.

**Paperless-ngx** *(optional — document management)*
- Go to Settings → Integrations → Paperless-ngx
- Enter your Paperless URL, API token and webhook secret
- Configure a Paperless Workflow to POST to `https://your-domain.com/api/paperless/webhook`
- See [`PAPERLESS_INTEGRATION.md`](PAPERLESS_INTEGRATION.md) for full setup guide

### Nginx + SSL Configuration

Install Nginx and Certbot on the host:

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/rentalsuite`:

```nginx
upstream rentalsuite_api {
    server 127.0.0.1:3001;
}

upstream rentalsuite_frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50m;

    # API — proxy to NestJS
    location /api {
        proxy_pass         http://rentalsuite_api;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Frontend — React SPA (static build)
    location / {
        proxy_pass         http://rentalsuite_frontend;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/rentalsuite /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Obtain free SSL certificate
sudo certbot --nginx -d your-domain.com --email you@example.com --agree-tos
```

### Updating to a new version

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Apply any new migrations
docker exec -it rentcrm-api sh -c "node_modules/.bin/prisma migrate deploy"
docker compose -f docker-compose.prod.yml restart api
```

### Useful Commands

```bash
# Load env vars into the shell (required for DB commands below)
source .env

# View real-time logs
docker compose -f docker-compose.prod.yml logs -f
docker logs rentcrm-api --tail=50

# Restart a service
docker compose -f docker-compose.prod.yml restart api

# Run migrations manually
docker exec -it rentcrm-api sh -c "node_modules/.bin/prisma migrate deploy"

# Open a psql session
docker exec -it rentcrm-postgres psql -U $POSTGRES_USER $POSTGRES_DB

# Database backup
docker exec rentcrm-postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB \
  | gzip > backup-$(date +%F).sql.gz

# Restore a backup
gunzip -c backup-YYYY-MM-DD.sql.gz \
  | docker exec -i rentcrm-postgres psql -U $POSTGRES_USER $POSTGRES_DB
```

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

### License

RentalSuite is released under the MIT license.

---
