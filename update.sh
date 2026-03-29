#!/usr/bin/env bash
# =============================================================================
# RentalSuite — Production Update Script  v1.0.0
# =============================================================================
# Pulls latest code and redeploys all services.
#
# Usage (from project root):
#   chmod +x update.sh && sudo ./update.sh
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
echo "  ║       RentalSuite — Production Updater           ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"

[[ -f "docker-compose.yml" ]] || \
    error "Run this script from the project root directory."

[[ -f ".env" ]] || \
    error ".env not found. Run setup.sh for a fresh installation."

# =============================================================================
# STEP 1 — Pull latest code
# =============================================================================
step "Step 1 — Pulling latest code from main"
git pull origin main
success "Code updated."

# =============================================================================
# STEP 2 — Install / update Node dependencies
# =============================================================================
step "Step 2 — Installing Node dependencies"
npm install
success "Dependencies up to date."

# =============================================================================
# STEP 3 — Build API
# =============================================================================
step "Step 3 — Building API"
npm run build --workspace=apps/api
success "API built."

# =============================================================================
# STEP 4 — Run Prisma migrations
# =============================================================================
step "Step 4 — Running database migrations"

POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
[[ -z "$POSTGRES_PASSWORD" ]] && error "POSTGRES_PASSWORD not found in .env"

HOST_DB_URL="postgresql://rentcrm:${POSTGRES_PASSWORD}@127.0.0.1:5432/rentcrm"
SCHEMA="apps/api/prisma/schema.prisma"

DATABASE_URL="${HOST_DB_URL}" npx prisma migrate deploy --schema="${SCHEMA}"
success "Migrations applied."

# =============================================================================
# STEP 5 — Rebuild and restart containers
# =============================================================================
step "Step 5 — Rebuilding and restarting containers"
docker compose up -d --build
success "Containers updated."

# =============================================================================
# DONE
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}  ✅  Update complete!${RESET}"
echo ""
docker compose ps
echo ""
