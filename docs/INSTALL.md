# RentalSuite - Installation Guide

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended) or LXC container
- Docker + Compose plugin (`docker compose version`)
- Domain with DNS pointing to the server (for HTTPS)
- No Node.js required on the server — all operations run inside containers


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
| `POSTGRES_USER` | PostgreSQL username (e.g. `rentcrm`) |
| `POSTGRES_DB` | PostgreSQL database name (e.g. `rentcrm`) |
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

> `DATABASE_URL` and `REDIS_URL` are constructed automatically by docker-compose from
> `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and `REDIS_PASSWORD`.
> Do not add them to `.env`.


## 3. Start containers

If you have containers from a previous installation with conflicting names, stop and remove them first:

```bash
docker compose -f docker-compose.prod.yml down
# or, to remove individual containers by name:
# docker rm -f rentcrm-api rentcrm-frontend rentcrm-postgres rentcrm-redis
```

Then start all services:

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps       # all should be Up
docker logs rentcrm-api --tail=30                  # wait until API is ready
```


## 4. Run database migrations

Migrations do **not** run automatically. Run them manually after the API container is up:

```bash
docker exec -it rentcrm-api sh -c "node_modules/.bin/prisma migrate deploy"
```

Expected output: `All migrations have been successfully applied.`

Restart the API after migrations so it picks up the updated schema:

```bash
docker compose -f docker-compose.prod.yml restart api
docker logs rentcrm-api --tail=20
```


## 5. Create your organization and admin user

The seed runs **once** inside the container — no Node.js needed on the host.

```bash
docker exec -it rentcrm-api sh -c "
  SEED_ORG_NAME='Your Company Name' \
  SEED_ADMIN_EMAIL='you@example.com' \
  SEED_ADMIN_PASSWORD='your-secure-password' \
  node dist/prisma/seed.js
"
```

Optional variables:

| Variable | Description |
|---|---|
| `SEED_ORG_NIF` | Tax ID / NIF of the organization |
| `SEED_ORG_ADDRESS` | Organization address |
| `SEED_ADMIN_NAME` | Admin display name (default: `Admin`) |

Full example with all variables:

```bash
docker exec -it rentcrm-api sh -c "
  SEED_ORG_NAME='Acme Rentals SL' \
  SEED_ORG_NIF='B12345678' \
  SEED_ORG_ADDRESS='Calle Mayor 1, Valencia' \
  SEED_ADMIN_EMAIL='you@example.com' \
  SEED_ADMIN_PASSWORD='your-secure-password' \
  SEED_ADMIN_NAME='Admin' \
  node dist/prisma/seed.js
"
```

The seed uses upsert — safe to re-run if needed (no duplicate data).

**After first login:** change your password from Settings > Profile.
All other configuration (SMTP, Paperless, SES, etc.) is managed from within the app.


## 6. Configure Nginx + SSL

Install Nginx and Certbot, then create `/etc/nginx/sites-available/rentalsuite`:

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

    client_max_body_size 50m;

    location /api {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location / {
        proxy_pass         http://127.0.0.1:3000;
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
certbot --nginx -d rentalsuite.example.com
```


## 7. Verify

```bash
docker compose -f docker-compose.prod.yml ps   # all containers Up
docker logs rentcrm-api --tail=20              # ends with "started on port 3001"
```

Open `https://your-domain.com` and log in with the credentials from step 5.


## Updating to a new version

Pull the new images and restart (no local rebuild needed):

```bash
cd ~/rentcrm-pro
git pull origin main
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Run any new migrations
docker exec -it rentcrm-api sh -c "node_modules/.bin/prisma migrate deploy"
docker compose -f docker-compose.prod.yml restart api
docker logs rentcrm-api --tail=20
```


## Useful commands

```bash
# Load env variables into the current shell (needed for DB commands below)
source .env

# View logs
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

# Prisma migrations (from host, development only)
PGPASS=$(grep POSTGRES_PASSWORD .env | cut -d= -f2)
DATABASE_URL="postgresql://${POSTGRES_USER}:${PGPASS}@127.0.0.1:5432/${POSTGRES_DB}" \
  npx prisma migrate dev --name migration_name \
  --schema=apps/api/prisma/schema.prisma
```
