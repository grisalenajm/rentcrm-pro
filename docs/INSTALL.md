# RentalSuite - Installation Guide

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended) or LXC container
- Docker + Compose plugin installed
- Node.js 20+ (the installer handles this automatically on Ubuntu)
- Domain with DNS pointing to the server (for HTTPS)


## 1. Clone the repository

```bash
git clone https://github.com/grisalenajm/rentcrm-pro.git
cd rentcrm-pro
git checkout main
```


## 2. Configure environment variables

```bash
cp .env.example .env
nano .env
```

Fill in every value marked `CHANGE_ME`:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL password. Generate: `openssl rand -hex 32` |
| `REDIS_PASSWORD` | Redis password. Generate: `openssl rand -hex 32` |
| `JWT_SECRET` | JWT signing secret. Generate: `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | Access token TTL (default: `15m`) |
| `FRONTEND_URL` | Public URL of the app, e.g. `https://rentalsuite.example.com` |
| `VITE_API_URL` | Same as `FRONTEND_URL` when behind Nginx |
| `API_PUBLIC_URL` | Same as `FRONTEND_URL` when behind Nginx |
| `API_PORT` | API port exposed by Docker (default: `3001`) |
| `NODE_ENV` | Set to `production` |
| `LIBRETRANSLATE_URL` | Leave as `http://libretranslate:5000` (internal Docker) |

> DATABASE_URL and REDIS_URL are constructed automatically by docker-compose.yml
> from POSTGRES_PASSWORD and REDIS_PASSWORD. Do not add them to .env.


## 3. Run the installer

```bash
chmod +x setup.sh
sudo ./setup.sh
```

The script:
1. Installs Node.js 20 if needed
2. Runs `npm install`
3. Builds the API
4. Creates `apps/frontend/.env` from the example
5. Starts all Docker containers (postgres, redis, api, frontend, libretranslate)
6. Runs Prisma schema sync and migrations


## 4. Create your organization and admin user

The seed is not automatic - run it once with your own values:

```bash
cd ~/rentcrm-pro
PGPASS=$(grep POSTGRES_PASSWORD .env | cut -d= -f2)

DATABASE_URL="postgresql://rentcrm:${PGPASS}@127.0.0.1:5432/rentcrm" \
SEED_ORG_NAME="Your Company Name" \
SEED_ADMIN_EMAIL="you@example.com" \
SEED_ADMIN_PASSWORD="your-secure-password" \
npx prisma db seed --schema=apps/api/prisma/schema.prisma
```

Optional variables:

| Variable | Description |
|---|---|
| `SEED_ORG_NIF` | Tax ID / NIF of the organization |
| `SEED_ORG_ADDRESS` | Organization address |
| `SEED_ADMIN_NAME` | Admin display name (default: `Admin`) |

The seed uses upsert - it is safe to run again if needed (no duplicate data).

**After first login:** change your password from Settings > Profile.
All other configuration (SMTP, Paperless, SES, etc.) is managed from within the app.


## 5. Configure Nginx + SSL

Install Nginx and Certbot, then create a site config:

```nginx
server {
    listen 80;
    server_name rentalsuite.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name rentalsuite.example.com;

    ssl_certificate     /etc/letsencrypt/live/rentalsuite.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rentalsuite.example.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Obtain SSL certificate:

```bash
certbot --nginx -d rentalsuite.example.com
```


## 6. Verify

```bash
docker compose ps               # all containers should be Up
docker logs rentcrm-api --tail=20  # should end with "started on port 3001"
```

Open `https://your-domain.com` and log in with the credentials you set in step 4.


## Updating to a new version

```bash
chmod +x update.sh
./update.sh
```

The script: git pull + build + migrate + restart containers.


## Useful commands

```bash
# Rebuild and restart API
npm run build --workspace=apps/api
docker compose build api && docker compose up -d api
docker logs rentcrm-api --tail=20

# Rebuild frontend
docker compose up -d --build frontend

# View all logs
docker compose logs -f

# Prisma migrations (always from host, never from container)
PGPASS=$(grep POSTGRES_PASSWORD .env | cut -d= -f2)
DATABASE_URL="postgresql://rentcrm:${PGPASS}@127.0.0.1:5432/rentcrm" \
  npx prisma migrate dev --name migration_name --schema=apps/api/prisma/schema.prisma
```
