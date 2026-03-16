#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# RentCRM Pro — Automated installer
# =============================================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

info()    { echo -e "${BOLD}[INFO]${RESET} $*"; }
success() { echo -e "${GREEN}[OK]${RESET}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }

echo ""
echo -e "${BOLD}=============================="
echo -e " RentCRM Pro — Installer"
echo -e "==============================${RESET}"
echo ""

# -----------------------------------------------------------------------------
# 1. Check Docker
# -----------------------------------------------------------------------------
info "Checking Docker installation..."

command -v docker >/dev/null 2>&1 || error "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || error "Docker Compose plugin is not installed. See https://docs.docker.com/compose/install/"

success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
success "Docker Compose $(docker compose version --short)"

# -----------------------------------------------------------------------------
# 2. Create .env if it doesn't exist
# -----------------------------------------------------------------------------
if [ ! -f ".env" ]; then
  info "Creating .env from .env.example..."
  cp .env.example .env
  success ".env created"
else
  warn ".env already exists — skipping copy"
fi

# -----------------------------------------------------------------------------
# 3. Prompt user to configure .env
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}======================================================${RESET}"
echo -e "${YELLOW} ACTION REQUIRED: edit .env before continuing${RESET}"
echo -e "${YELLOW}======================================================${RESET}"
echo ""
echo "  At minimum, set the following values:"
echo ""
echo "    DATABASE_URL          — change CHANGE_ME to a strong password"
echo "    POSTGRES_PASSWORD     — same password as in DATABASE_URL"
echo "    REDIS_URL / REDIS_PASSWORD — generate with: openssl rand -hex 32"
echo "    JWT_SECRET            — generate with: openssl rand -hex 64"
echo "    JWT_REFRESH_SECRET    — generate with: openssl rand -hex 64"
echo "    FRONTEND_URL          — your server IP or domain, e.g. http://192.168.1.10:3000"
echo "    VITE_API_URL          — your server IP or domain, e.g. http://192.168.1.10:3001"
echo ""
echo "  Optional (for email features):"
echo "    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM"
echo ""
read -rp "Have you edited .env with your values? [y/N] " confirm
case "$confirm" in
  [yY][eE][sS]|[yY]) ;;
  *) echo ""; warn "Please edit .env and run ./setup.sh again."; echo ""; exit 0 ;;
esac

# Sanity-check: reject placeholder values
if grep -q "CHANGE_ME" .env; then
  error "Found 'CHANGE_ME' placeholders in .env — please replace all of them."
fi
if grep -q "YOUR_IP_OR_DOMAIN" .env; then
  error "Found 'YOUR_IP_OR_DOMAIN' placeholders in .env — set your real IP or domain."
fi

# -----------------------------------------------------------------------------
# 4. Load FRONTEND_PORT and API_PORT for final message
# -----------------------------------------------------------------------------
FRONTEND_PORT=$(grep -E '^FRONTEND_PORT=' .env | cut -d= -f2 | tr -d '"' || echo "3000")
API_PORT=$(grep -E '^API_PORT=' .env | cut -d= -f2 | tr -d '"' || echo "3001")
FRONTEND_PORT=${FRONTEND_PORT:-3000}
API_PORT=${API_PORT:-3001}

# -----------------------------------------------------------------------------
# 5. Build images
# -----------------------------------------------------------------------------
echo ""
info "Building Docker images (this may take a few minutes)..."
docker compose -f docker-compose.prod.yml build
success "Images built"

# -----------------------------------------------------------------------------
# 6. Start services
# -----------------------------------------------------------------------------
info "Starting services..."
docker compose -f docker-compose.prod.yml up -d
success "Services started"

# -----------------------------------------------------------------------------
# 7. Wait for API container to be ready
# -----------------------------------------------------------------------------
info "Waiting for API to be ready..."
for i in $(seq 1 30); do
  if docker exec rentcrm-api node -e "process.exit(0)" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# -----------------------------------------------------------------------------
# 8. Run Prisma migrations
# -----------------------------------------------------------------------------
info "Running database migrations..."
docker exec rentcrm-api npx prisma migrate deploy
success "Migrations applied"

# -----------------------------------------------------------------------------
# 9. Done
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}======================================================"
echo -e " ✅  RentCRM Pro installed successfully"
echo -e "======================================================${RESET}"
echo ""
echo -e "  Frontend : ${BOLD}http://localhost:${FRONTEND_PORT}${RESET}"
echo -e "  API      : ${BOLD}http://localhost:${API_PORT}${RESET}"
echo ""
echo -e "  ${YELLOW}First login:${RESET}"
echo -e "  Create your admin user by running:"
echo ""
echo -e "    docker exec -it rentcrm-api npx prisma studio"
echo -e "    — or use the API: POST /api/auth/setup (see docs)"
echo ""
echo -e "  To view logs:"
echo -e "    docker compose -f docker-compose.prod.yml logs -f"
echo ""
