#!/usr/bin/env bash
# =============================================================================
# RentalSuite — Fresh Installation Script  v2.0.0
# =============================================================================
# Runs from the project root on a clean server.
# Prerequisites: Docker + Compose plugin already installed.
#
# Usage:
#   cp .env.example .env && nano .env   # fill in secrets
#   chmod +x setup.sh && sudo ./setup.sh
# =============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

info()    { echo -e "${BOLD}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }
step()    { echo -e "\n${CYAN}${BOLD}─── $* ───${RESET}"; }

echo ""
echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║       RentalSuite — Production Installer         ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"

# Must run from the project root
[[ -f "docker-compose.yml" ]] || \
    error "Run this script from the project root directory."

# Must have .env
[[ -f ".env" ]] || \
    error ".env not found. Copy .env.example to .env and fill in your secrets first."

# =============================================================================
# STEP 1 — Node.js 20
# =============================================================================
step "Step 1 — Node.js 20"

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node --version | tr -d 'v' | cut -d. -f1)
fi

if [[ "$NODE_MAJOR" -lt 20 ]]; then
    info "Node.js ${NODE_MAJOR:-not found} detected — installing Node.js 20 via NodeSource..."
    command -v curl >/dev/null 2>&1 || apt-get install -y curl
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    success "Node.js $(node --version) installed."
else
    success "Node.js $(node --version) — OK."
fi

command -v docker >/dev/null 2>&1 \
    || error "Docker is not installed. See https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 \
    || error "Docker Compose plugin missing. See https://docs.docker.com/compose/install/"
success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# =============================================================================
# STEP 2 — npm install
# =============================================================================
step "Step 2 — Installing Node dependencies"
npm install
success "Dependencies installed."

# =============================================================================
# STEP 3 — Build API
# =============================================================================
step "Step 3 — Building API"
npm run build --workspace=apps/api
success "API built."

# =============================================================================
# STEP 4 — Frontend .env
# =============================================================================
step "Step 4 — Frontend environment file"
if [[ ! -f "apps/frontend/.env" ]]; then
    cp apps/frontend/.env.example apps/frontend/.env
    # Inject VITE_API_URL from root .env if set
    VITE_API_URL_VAL=$(grep -E '^VITE_API_URL=' .env | cut -d= -f2- || true)
    if [[ -n "$VITE_API_URL_VAL" ]]; then
        sed -i "s|VITE_API_URL=.*|VITE_API_URL=${VITE_API_URL_VAL}|" apps/frontend/.env
        success "apps/frontend/.env created with VITE_API_URL=${VITE_API_URL_VAL}"
    else
        warn "apps/frontend/.env created from example — set VITE_API_URL before rebuilding frontend."
    fi
else
    success "apps/frontend/.env already exists — skipping."
fi

# =============================================================================
# STEP 5 — Start containers
# =============================================================================
step "Step 5 — Starting Docker containers"
docker compose up -d
info "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker exec rentcrm-postgres pg_isready -U rentcrm >/dev/null 2>&1 || [[ $RETRIES -eq 0 ]]; do
    RETRIES=$((RETRIES - 1))
    sleep 2
done
[[ $RETRIES -eq 0 ]] && error "PostgreSQL did not become ready in time."
success "PostgreSQL is ready."

# =============================================================================
# STEP 6 — Prisma: db push → migrate deploy → seed
# =============================================================================
step "Step 6 — Database schema & seed"

# Read password from .env to build host-side DATABASE_URL (localhost, not Docker)
POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
[[ -z "$POSTGRES_PASSWORD" ]] && error "POSTGRES_PASSWORD not found in .env"

HOST_DB_URL="postgresql://rentcrm:${POSTGRES_PASSWORD}@127.0.0.1:5432/rentcrm"
SCHEMA="apps/api/prisma/schema.prisma"

info "Running prisma db push (schema sync)..."
DATABASE_URL="${HOST_DB_URL}" npx prisma db push --schema="${SCHEMA}" --accept-data-loss
success "Schema pushed."

info "Running prisma migrate deploy..."
DATABASE_URL="${HOST_DB_URL}" npx prisma migrate deploy --schema="${SCHEMA}"
success "Migrations applied."

info "Running prisma db seed..."
DATABASE_URL="${HOST_DB_URL}" npx prisma db seed --schema="${SCHEMA}" || \
    warn "Seed returned non-zero (may be safe to ignore if DB already has data)."
success "Seed complete."

# =============================================================================
# DONE
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║   ✅  RentalSuite installed successfully!            ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo ""
docker compose ps
echo ""
echo -e "  ${YELLOW}Next steps:${RESET}"
echo "  1. Configure Nginx + SSL (see README.md)"
echo "  2. Open https://your-domain.com and log in"
echo "  3. Configure SMTP, SES and other settings"
echo ""
echo -e "  ${YELLOW}⚠  Keep .env secret — never commit it to version control.${RESET}"
echo ""
