# Best Practices — RentalSuite

## Schema & Migrations

### Always use `prisma migrate dev` for schema changes

Every change to `prisma/schema.prisma` must be accompanied by a migration file
so that `prisma migrate deploy` (run at container startup) keeps the DB in sync.

```bash
# Get the real password
PGPASS=$(grep POSTGRES_PASSWORD ~/rentcrm-pro/.env | cut -d= -f2)

# Apply schema change and create migration
DATABASE_URL="postgresql://rentcrm:${PGPASS}@127.0.0.1:5432/rentcrm" \
  npx prisma migrate dev --name describe_what_changed \
  --schema=apps/api/prisma/schema.prisma
```

Never use `prisma db push` — it skips migration file creation.

### Verify schema/migration parity after changes

After any migration work, confirm no drift remains:

```bash
PGPASS=$(grep POSTGRES_PASSWORD ~/rentcrm-pro/.env | cut -d= -f2)

# Create shadow DB
docker exec rentcrm-postgres psql -U rentcrm -c "CREATE DATABASE rentcrm_shadow;"

# Run diff (exit code 0 = in sync, 2 = drift found)
DATABASE_URL="postgresql://rentcrm:${PGPASS}@127.0.0.1:5432/rentcrm" \
SHADOW_DATABASE_URL="postgresql://rentcrm:${PGPASS}@127.0.0.1:5432/rentcrm_shadow" \
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema ./prisma/schema.prisma \
  --script --exit-code

# Drop shadow DB
docker exec rentcrm-postgres psql -U rentcrm -c "DROP DATABASE rentcrm_shadow;"
```

If the output is `-- This is an empty migration.` and exit code is 0, the schema is clean.

### Never modify existing migration files

Migration files under `prisma/migrations/` are immutable once applied.
If you need to fix something, create a new migration.

---

## Git Workflow

### Branch strategy: `develop` → `main`

- **`develop`**: all day-to-day work goes here
- **`main`**: production-only; only updated via explicit merge from `develop`

```bash
# Daily work
git checkout develop
git add ... && git commit -m "feat: ..." && git push origin develop

# Releasing to production (only when requested and verified)
git checkout main && git merge develop && git push origin main && git checkout develop
```

### Commit messages

- Written in English
- No `Co-Authored-By` trailer
- Use conventional prefixes: `feat:`, `fix:`, `chore:`, `docs:`

---

## Docker / API

### Always rebuild after schema or code changes

```bash
cd ~/rentcrm-pro
npm run build --workspace=apps/api
docker compose build api && docker compose up -d api
docker logs rentcrm-api --tail=20
```

### Prisma CLI always runs from the host

The Prisma CLI (`migrate dev`, `migrate diff`, `db seed`) must run from the host
with a direct PostgreSQL connection (`127.0.0.1:5432`), never from inside the container.
The `apps/api/.env` uses Prisma Accelerate — do not use that URL for CLI commands.

```bash
PGPASS=$(grep POSTGRES_PASSWORD ~/rentcrm-pro/.env | cut -d= -f2)
DATABASE_URL="postgresql://rentcrm:${PGPASS}@127.0.0.1:5432/rentcrm" npx prisma ...
```

### Running the seed in production

The seed is compiled into the Docker image at `dist/prisma/seed.js`.
Run it once with your own values after the first deploy:

```bash
docker exec -it rentcrm-api sh -c "
  SEED_ORG_NAME='Your Company' \
  SEED_ADMIN_EMAIL='you@example.com' \
  SEED_ADMIN_PASSWORD='secure-password' \
  node dist/prisma/seed.js
"
```

The seed uses upsert — it is safe to run again if needed.

---

## Environment variables

### Never duplicate DATABASE_URL or REDIS_URL in `.env`

These are constructed by `docker-compose.yml` from individual variables:
```yaml
DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
REDIS_URL:    "redis://:${REDIS_PASSWORD}@redis:6379"
```
Adding them to `.env` is redundant and a source of subtle conflicts.

### Use `POSTGRES_USER` and `POSTGRES_DB` variables everywhere

Never hardcode `rentcrm` as a username or database name in compose files.
Always reference `${POSTGRES_USER}` and `${POSTGRES_DB}`.
