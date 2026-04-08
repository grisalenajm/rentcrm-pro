# Common Mistakes — RentalSuite

## 1. Using `prisma db push` instead of `prisma migrate dev`

**The mistake:**
```bash
# WRONG — never use this for schema changes
DATABASE_URL='...' npx prisma db push
```

**Why it's a problem:**
`prisma db push` applies schema changes directly to the database without creating a migration file.
The schema and the live DB stay in sync locally, but:
- The change is invisible to migration history
- `prisma migrate deploy` (run at Docker container startup) will not apply it
- Any fresh installation or CI environment ends up with a DB missing those columns/tables
- This caused a P2022 "column not available" production incident (see migration `20260402000001`)

**The fix:**
```bash
# CORRECT — always use migrate dev for any schema change
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' \
  npx prisma migrate dev --name descriptive_name \
  --schema=apps/api/prisma/schema.prisma
```

---

## 2. Committing directly to `main`

**The mistake:** making commits or pushes directly to the `main` branch.

**Why it's a problem:** `main` is the production branch. All work must go through `develop`
so changes can be reviewed before reaching production.

**The fix:** always work on `develop`. Merge to `main` only when explicitly requested and verified.

```bash
# CORRECT
git checkout develop
git add ... && git commit -m "..." && git push origin develop
# merge to main only when asked
```

---

## 3. Hardcoding credentials or usernames in docker-compose files

**The mistake:**
```yaml
test: ["CMD-SHELL", "pg_isready -U rentcrm"]
DATABASE_URL: "postgresql://rentcrm:${POSTGRES_PASSWORD}@postgres:5432/rentcrm"
```

**Why it's a problem:** changing `POSTGRES_USER` or `POSTGRES_DB` in `.env` has no effect;
the hardcoded values silently override it.

**The fix:** always use variables:
```yaml
test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
```

---

## 4. Running `prisma migrate diff` without a shadow database

`prisma migrate diff --from-migrations` requires a shadow database to replay migrations.
In Prisma 7, configure it temporarily:

```bash
# 1. Create shadow DB
docker exec rentcrm-postgres psql -U rentcrm -c "CREATE DATABASE rentcrm_shadow;"

# 2. Run diff
DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm' \
SHADOW_DATABASE_URL='postgresql://rentcrm:<pwd>@127.0.0.1:5432/rentcrm_shadow' \
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema ./prisma/schema.prisma \
  --script

# 3. Drop shadow DB when done
docker exec rentcrm-postgres psql -U rentcrm -c "DROP DATABASE rentcrm_shadow;"
```

Do NOT add `shadowDatabaseUrl: env('SHADOW_DATABASE_URL')` permanently to `prisma.config.ts`:
it will break `prisma migrate deploy` at container startup when the variable is absent.

---

## SES SSL en PRD: carpeta certs/ vacía
- Síntoma: ❌ Error SSL: UNABLE_TO_VERIFY_LEAF_SIGNATURE en PRD, funciona en DEV
- Causa: compose.yml de PRD monta `./certs:/app/certs:ro` pero la carpeta está vacía
- ✅ Solución: copiar mir-ca.pem desde DEV a PRD via host Proxmox:
  pct pull 123 /home/rentcrm/rentcrm-pro/apps/api/certs/mir-ca.pem /tmp/mir-ca.pem
  pct push 124 /tmp/mir-ca.pem /home/rentcrm/rentalsuite/certs/mir-ca.pem
  docker restart rentcrm-api
- Nota: los certs FNMT (.crt) están dentro de la imagen Docker pero mir-ca.pem
  lo usa SesService directamente desde /app/certs/ — debe existir en el host de PRD
