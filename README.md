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
- **Node.js** ≥ 20 + npm (for Prisma CLI and building images)
- A Linux server with ports 80/443 open (for Nginx + Let's Encrypt)
- An **SMTP account** (optional, needed for email features)

> **Node.js 20 on Ubuntu 24.04** — Ubuntu 24.04 ships Node 18 by default.
> Install Node 20 via NodeSource before running any `npm` commands:
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
> sudo apt-get install -y nodejs
> node --version   # should print v20.x.x
> ```

### Quick Start (local development, 5 min)

```bash
git clone https://github.com/your-org/rentalsuite.git
cd rentalsuite

# Infrastructure
docker compose up -d postgres redis

# Dependencies
npm install

# Database
cd apps/api
DATABASE_URL="postgresql://rentcrm:CHANGE_ME@localhost:5432/rentcrm" npx prisma migrate dev
cd ../..

# Run API (terminal 1)
npm run dev --workspace=apps/api

# Run frontend (terminal 2)
npm run dev --workspace=apps/frontend
```

Frontend: http://localhost:5173 — API: http://localhost:3001

### Full Installation (production)

#### Option A — Automated (recommended)

```bash
git clone https://github.com/your-org/rentalsuite.git
cd rentalsuite
chmod +x setup.sh
sudo ./setup.sh
```

The script checks requirements, collects configuration interactively, generates
`.env`, builds Docker images, runs database migrations, and configures Nginx + SSL.

#### Option B — Manual step-by-step

**1. Clone the repository**

```bash
git clone https://github.com/your-org/rentalsuite.git
cd rentalsuite
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` and replace every `CHANGE_ME` / `YOUR_DOMAIN` placeholder:

```bash
# Minimum required (DATABASE_URL and REDIS_URL are auto-built by docker-compose):
POSTGRES_PASSWORD=strong-password       # openssl rand -hex 32
REDIS_PASSWORD=another-strong-password  # openssl rand -hex 32
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
FRONTEND_URL=https://your-domain.com
VITE_API_URL=https://your-domain.com
```

**2b. Create the frontend environment file**

```bash
cp apps/frontend/.env.example apps/frontend/.env
# Edit apps/frontend/.env and set VITE_API_URL=https://your-domain.com
```

This file is required by the frontend Docker build (`COPY apps/frontend/.env ./.env`).

**3. Install Node dependencies**

```bash
npm install
```

**4. Build Docker images**

```bash
docker compose -f docker-compose.prod.yml build
```

**5. Start services**

```bash
docker compose -f docker-compose.prod.yml up -d
```

**6. Run database migrations**

```bash
cd apps/api

# On a fresh install, sync the schema first (handles any migration/schema drift):
DATABASE_URL="postgresql://rentcrm:strong-password@localhost:5432/rentcrm" \
  npx prisma db push

# Then apply pending migrations:
DATABASE_URL="postgresql://rentcrm:strong-password@localhost:5432/rentcrm" \
  npx prisma migrate deploy

# Seed initial data (first install only):
DATABASE_URL="postgresql://rentcrm:strong-password@localhost:5432/rentcrm" \
  npx prisma db seed

cd ../..
```

**7. Configure Nginx + SSL** — see section below.

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

### Useful Commands

```bash
# View real-time logs
docker compose -f docker-compose.prod.yml logs -f

# Restart a single service
docker compose -f docker-compose.prod.yml restart api

# Deploy API update
npm run build --workspace=apps/api
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api

# Deploy frontend update
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend

# PostgreSQL backup
docker exec rentcrm-postgres pg_dump -U rentcrm rentcrm | gzip > backup-$(date +%F).sql.gz

# Restore backup
gunzip -c backup-YYYY-MM-DD.sql.gz | docker exec -i rentcrm-postgres psql -U rentcrm rentcrm

# Run Prisma migrations after update
cd apps/api
DATABASE_URL="postgresql://rentcrm:PASSWORD@localhost:5432/rentcrm" npx prisma migrate deploy

# Open a psql session
docker exec -it rentcrm-postgres psql -U rentcrm rentcrm
```

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

### License

RentalSuite is released under the MIT license.

---
