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
# Minimum required:
DATABASE_URL=postgresql://rentcrm:strong-password@postgres:5432/rentcrm
POSTGRES_PASSWORD=strong-password
REDIS_PASSWORD=another-strong-password
REDIS_URL=redis://:another-strong-password@redis:6379
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
FRONTEND_URL=https://your-domain.com
VITE_API_URL=https://your-domain.com
```

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
DATABASE_URL="postgresql://rentcrm:strong-password@localhost:5432/rentcrm" \
  npx prisma migrate deploy
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

RentalSuite is released under the [GNU General Public License v3.0](LICENSE).

---

## 🇪🇸 Español

### Requisitos

- **Docker** ≥ 24 con el plugin Compose (`docker compose version`)
- **Node.js** ≥ 20 + npm (para Prisma CLI y compilar las imágenes)
- Un servidor Linux con los puertos 80/443 abiertos (para Nginx + Let's Encrypt)
- Una **cuenta SMTP** (opcional, necesaria para funciones de email)

### Inicio rápido (desarrollo local, 5 min)

```bash
git clone https://github.com/your-org/rentalsuite.git
cd rentalsuite

# Infraestructura
docker compose up -d postgres redis

# Dependencias
npm install

# Base de datos
cd apps/api
DATABASE_URL="postgresql://rentcrm:CHANGE_ME@localhost:5432/rentcrm" npx prisma migrate dev
cd ../..

# Lanzar API (terminal 1)
npm run dev --workspace=apps/api

# Lanzar frontend (terminal 2)
npm run dev --workspace=apps/frontend
```

Frontend: http://localhost:5173 — API: http://localhost:3001

### Instalación completa (producción)

#### Opción A — Automatizada (recomendada)

```bash
git clone https://github.com/your-org/rentalsuite.git
cd rentalsuite
chmod +x setup.sh
sudo ./setup.sh
```

El script comprueba los requisitos, solicita la configuración de forma interactiva,
genera el `.env`, construye las imágenes Docker, ejecuta las migraciones de base de
datos y configura Nginx + SSL.

#### Opción B — Manual paso a paso

**1. Clonar el repositorio**

```bash
git clone https://github.com/your-org/rentalsuite.git
cd rentalsuite
```

**2. Configurar variables de entorno**

```bash
cp .env.example .env
```

Edita `.env` y sustituye todos los valores `CHANGE_ME` / `YOUR_DOMAIN`:

```bash
DATABASE_URL=postgresql://rentcrm:contraseña-fuerte@postgres:5432/rentcrm
POSTGRES_PASSWORD=contraseña-fuerte
REDIS_PASSWORD=otra-contraseña-fuerte
REDIS_URL=redis://:otra-contraseña-fuerte@redis:6379
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
FRONTEND_URL=https://tu-dominio.com
VITE_API_URL=https://tu-dominio.com
```

**3. Instalar dependencias Node**

```bash
npm install
```

**4. Construir las imágenes Docker**

```bash
docker compose -f docker-compose.prod.yml build
```

**5. Arrancar los servicios**

```bash
docker compose -f docker-compose.prod.yml up -d
```

**6. Ejecutar migraciones de base de datos**

```bash
cd apps/api
DATABASE_URL="postgresql://rentcrm:contraseña-fuerte@localhost:5432/rentcrm" \
  npx prisma migrate deploy
cd ../..
```

**7. Configurar Nginx + SSL** — ver bloque completo en la sección inglesa.

### Configuración Nginx + SSL

Instalar Nginx y Certbot en el host:

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Crear `/etc/nginx/sites-available/rentalsuite` con el bloque de la sección inglesa,
sustituyendo `your-domain.com` por tu dominio.

```bash
sudo ln -s /etc/nginx/sites-available/rentalsuite /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Obtener certificado SSL gratuito
sudo certbot --nginx -d tu-dominio.com --email tu@email.com --agree-tos
```

### Comandos útiles

```bash
# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f

# Reiniciar un servicio concreto
docker compose -f docker-compose.prod.yml restart api

# Actualizar la API tras cambios de código
npm run build --workspace=apps/api
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api

# Actualizar el frontend
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend

# Backup de PostgreSQL
docker exec rentcrm-postgres pg_dump -U rentcrm rentcrm | gzip > backup-$(date +%F).sql.gz

# Restaurar backup
gunzip -c backup-YYYY-MM-DD.sql.gz | docker exec -i rentcrm-postgres psql -U rentcrm rentcrm

# Ejecutar migraciones tras actualización
cd apps/api
DATABASE_URL="postgresql://rentcrm:CONTRASEÑA@localhost:5432/rentcrm" npx prisma migrate deploy

# Abrir sesión psql
docker exec -it rentcrm-postgres psql -U rentcrm rentcrm
```

---

## 📄 License / Licencia

[GNU General Public License v3.0](LICENSE) — © RentalSuite contributors
