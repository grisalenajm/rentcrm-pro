#!/usr/bin/env bash
# =============================================================================
# RentalSuite — Automated Production Installer  v1.2.0
# =============================================================================
# This script:
#   1. Checks system requirements
#   2. Collects configuration interactively (domain, SMTP, optional Paperless)
#   3. Generates .env with secure random secrets
#   4. Builds Docker images and starts all services
#   5. Runs Prisma database migrations from the host
#   6. Configures Nginx virtual host and obtains a Let's Encrypt SSL certificate
#
# Usage:
#   chmod +x setup.sh
#   sudo ./setup.sh
#
# Re-running the script is safe — it detects existing configuration.
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
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

# ── Prompt helpers ────────────────────────────────────────────────────────────
ask() {
    # ask "prompt" [default]  →  prints the user's answer (or default)
    local prompt="$1"
    local default="${2:-}"
    local val
    if [[ -n "$default" ]]; then
        read -rp "$(echo -e "${BOLD}  ${prompt}${RESET} [${default}]: ")" val
        echo "${val:-$default}"
    else
        read -rp "$(echo -e "${BOLD}  ${prompt}${RESET}: ")" val
        echo "$val"
    fi
}

ask_secret() {
    # ask_secret "prompt"  →  hidden input, prints the user's answer
    local prompt="$1"
    local val
    read -rsp "$(echo -e "${BOLD}  ${prompt}${RESET}: ")" val
    echo ""   # newline after hidden input
    echo "$val"
}

ask_yesno() {
    # ask_yesno "prompt" [Y|N]  →  returns 0 (yes) or 1 (no)
    local prompt="$1"
    local default="${2:-N}"
    local val
    read -rp "$(echo -e "${BOLD}  ${prompt}${RESET} [y/N]: ")" val
    case "${val:-$default}" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# =============================================================================
# BANNER
# =============================================================================
echo ""
echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║          RentalSuite — Production Installer      ║"
echo "  ║          Instalador de Producción  v1.2.0        ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo "  This script sets up RentalSuite on a fresh Linux server."
echo "  Este script instala RentalSuite en un servidor Linux."
echo ""

# Must run from the project root
[[ -f "docker-compose.prod.yml" ]] || \
    error "Run this script from the project root directory. / Ejecuta este script desde la raíz del proyecto."

# =============================================================================
# STEP 1 — Requirements / Requisitos
# =============================================================================
step "Step 1/5 — Checking requirements  |  Comprobando requisitos"

command -v docker >/dev/null 2>&1 \
    || error "Docker is not installed.\n  https://docs.docker.com/get-docker/\n\n  Docker no está instalado."

docker compose version >/dev/null 2>&1 \
    || error "Docker Compose plugin missing.\n  https://docs.docker.com/compose/install/\n\n  Falta el plugin Docker Compose."

command -v node >/dev/null 2>&1 \
    || error "Node.js ≥ 20 is required.\n  https://nodejs.org/\n\n  Se requiere Node.js ≥ 20."

command -v npm >/dev/null 2>&1 \
    || error "npm is not installed.  |  npm no está instalado."

command -v openssl >/dev/null 2>&1 \
    || error "openssl is required to generate secrets.  |  openssl es necesario para generar claves."

success "Docker  $(docker --version | awk '{print $3}' | tr -d ',')"
success "Compose $(docker compose version --short)"
success "Node    $(node --version)"
success "npm     $(npm --version)"

# =============================================================================
# STEP 2 — Interactive configuration / Configuración interactiva
# =============================================================================
step "Step 2/5 — Configuration  |  Configuración"
echo ""
echo "  Answer the questions below to configure your installation."
echo "  Responde las preguntas para configurar la instalación."
echo ""

# ── Domain ────────────────────────────────────────────────────────────────────
echo -e "  ${YELLOW}Domain / Dominio${RESET}"
DOMAIN=$(ask "Your domain (e.g. rentalsuite.example.com)  |  Tu dominio")
[[ -z "$DOMAIN" ]] && error "Domain is required.  |  El dominio es obligatorio."

LETSENCRYPT_EMAIL=$(ask "Email for Let's Encrypt SSL  |  Email para certificado SSL")
[[ -z "$LETSENCRYPT_EMAIL" ]] && error "Email is required for SSL.  |  El email es obligatorio para SSL."

# ── Database credentials ───────────────────────────────────────────────────────
echo ""
echo -e "  ${YELLOW}Database / Base de datos${RESET}"
DB_PASS=$(ask_secret "PostgreSQL password (leave blank to auto-generate)  |  Contraseña PostgreSQL (vacío = generar)")
if [[ -z "$DB_PASS" ]]; then
    DB_PASS=$(openssl rand -hex 32)
    info "PostgreSQL password auto-generated.  |  Contraseña PostgreSQL generada automáticamente."
fi

# ── Redis credentials ──────────────────────────────────────────────────────────
echo ""
echo -e "  ${YELLOW}Redis${RESET}"
REDIS_PASS=$(ask_secret "Redis password (leave blank to auto-generate)  |  Contraseña Redis (vacío = generar)")
if [[ -z "$REDIS_PASS" ]]; then
    REDIS_PASS=$(openssl rand -hex 32)
    info "Redis password auto-generated.  |  Contraseña Redis generada automáticamente."
fi

# ── JWT secrets — always auto-generated ──────────────────────────────────────
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
info "JWT secrets auto-generated.  |  Claves JWT generadas automáticamente."

# ── SMTP ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${YELLOW}SMTP Email  (optional — leave blank to skip  |  opcional)${RESET}"
SMTP_HOST=$(ask "SMTP host  (e.g. smtp.gmail.com)" "")
SMTP_PORT=$(ask "SMTP port  |  Puerto SMTP" "587")
SMTP_USER=$(ask "SMTP user  |  Usuario SMTP" "")
SMTP_PASS=""
SMTP_FROM=""
if [[ -n "$SMTP_USER" ]]; then
    SMTP_PASS=$(ask_secret "SMTP password  |  Contraseña SMTP")
    SMTP_FROM=$(ask "From name/email  (e.g. RentalSuite <no-reply@example.com>)" "RentalSuite <${SMTP_USER}>")
fi

# ── Paperless-ngx ─────────────────────────────────────────────────────────────
echo ""
echo -e "  ${YELLOW}Paperless-ngx  (optional — leave blank to skip  |  opcional)${RESET}"
PAPERLESS_URL=$(ask "Paperless URL  (leave blank to skip  |  vacío para omitir)" "")
PAPERLESS_TOKEN=""
if [[ -n "$PAPERLESS_URL" ]]; then
    PAPERLESS_TOKEN=$(ask_secret "Paperless API token  |  Token API de Paperless")
fi

# =============================================================================
# STEP 3 — Generate .env / Generar .env
# =============================================================================
step "Step 3/5 — Generating .env  |  Generando .env"

if [[ -f ".env" ]]; then
    warn ".env already exists — creating .env.backup before overwriting."
    warn ".env ya existe — creando .env.backup antes de sobreescribir."
    cp .env .env.backup
fi

cat > .env << EOF
# RentalSuite — Production Environment
# Generated by setup.sh on $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# Keep this file secret — never commit it to version control.

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://rentcrm:${DB_PASS}@postgres:5432/rentcrm
POSTGRES_DB=rentcrm
POSTGRES_USER=rentcrm
POSTGRES_PASSWORD=${DB_PASS}

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://:${REDIS_PASS}@redis:6379
REDIS_PASSWORD=${REDIS_PASS}

# ── Authentication (JWT) ──────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=7d

# ── Application ───────────────────────────────────────────────────────────────
NODE_ENV=production
FRONTEND_URL=https://${DOMAIN}
VITE_API_URL=https://${DOMAIN}
FRONTEND_PORT=3000
API_PORT=3001

# ── LibreTranslate ────────────────────────────────────────────────────────────
LIBRETRANSLATE_URL=http://libretranslate:5000

# ── SMTP ──────────────────────────────────────────────────────────────────────
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}

# ── Paperless-ngx ─────────────────────────────────────────────────────────────
PAPERLESS_URL=${PAPERLESS_URL}
PAPERLESS_TOKEN=${PAPERLESS_TOKEN}
EOF

chmod 600 .env
success ".env generated with secure permissions (600).  |  .env generado con permisos seguros."

# =============================================================================
# STEP 4 — Build images and start services
#          Construir imágenes e iniciar servicios
# =============================================================================
step "Step 4/5 — Building & starting containers  |  Construyendo e iniciando contenedores"

info "Installing Node dependencies...  |  Instalando dependencias Node..."
npm install

info "Building Docker images (this may take a few minutes)..."
info "Construyendo imágenes Docker (puede tardar unos minutos)..."
docker compose -f docker-compose.prod.yml build

info "Starting services...  |  Iniciando servicios..."
docker compose -f docker-compose.prod.yml up -d

# ── Wait for postgres to be healthy ──────────────────────────────────────────
info "Waiting for PostgreSQL to be ready...  |  Esperando a que PostgreSQL esté listo..."
RETRIES=30
until docker exec rentcrm-postgres pg_isready -U rentcrm >/dev/null 2>&1 || [[ $RETRIES -eq 0 ]]; do
    RETRIES=$((RETRIES - 1))
    sleep 2
done
[[ $RETRIES -eq 0 ]] && error "PostgreSQL did not become ready in time.  |  PostgreSQL no estuvo listo a tiempo."
success "PostgreSQL is ready.  |  PostgreSQL está listo."

# ── Run Prisma migrations from the host ──────────────────────────────────────
# CLAUDE.md: migrations always run from the host, never from inside a container.
info "Running database migrations...  |  Ejecutando migraciones de base de datos..."
DATABASE_URL="postgresql://rentcrm:${DB_PASS}@127.0.0.1:5432/rentcrm" \
    npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
success "Migrations applied.  |  Migraciones aplicadas."

# =============================================================================
# STEP 5 — Nginx + SSL
# =============================================================================
step "Step 5/5 — Nginx + SSL"

NGINX_CONF="/etc/nginx/sites-available/rentalsuite"
NGINX_ENABLED="/etc/nginx/sites-enabled/rentalsuite"

if command -v nginx >/dev/null 2>&1; then
    info "Writing Nginx configuration...  |  Escribiendo configuración Nginx..."

    cat > "$NGINX_CONF" << NGINXEOF
# RentalSuite — Nginx virtual host
# Generated by setup.sh

upstream rentalsuite_api {
    server 127.0.0.1:3001;
}

upstream rentalsuite_frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50m;

    location /api {
        proxy_pass         http://rentalsuite_api;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location / {
        proxy_pass         http://rentalsuite_frontend;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

    ln -sf "$NGINX_CONF" "$NGINX_ENABLED" 2>/dev/null || true
    nginx -t && systemctl reload nginx
    success "Nginx configured and reloaded.  |  Nginx configurado y recargado."

    if command -v certbot >/dev/null 2>&1; then
        info "Obtaining Let's Encrypt certificate...  |  Obteniendo certificado Let's Encrypt..."
        certbot --nginx -d "$DOMAIN" --email "$LETSENCRYPT_EMAIL" --agree-tos --non-interactive
        success "SSL certificate obtained.  |  Certificado SSL obtenido."
    else
        warn "certbot not found. Run manually:  |  certbot no encontrado. Ejecuta manualmente:"
        warn "  sudo certbot --nginx -d ${DOMAIN} --email ${LETSENCRYPT_EMAIL} --agree-tos"
    fi
else
    warn "Nginx not found. See README.md for the Nginx + SSL configuration block."
    warn "Nginx no encontrado. Consulta README.md para el bloque de configuración."
fi

# =============================================================================
# DONE / LISTO
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║   ✅  RentalSuite installed successfully!            ║"
echo "  ║   ✅  ¡RentalSuite instalado correctamente!          ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  🌐  ${BOLD}https://${DOMAIN}${RESET}"
echo ""
echo "  Next steps / Próximos pasos:"
echo "  ─────────────────────────────────────────────────────────"
echo "  1. Open the URL above and log in with your admin account."
echo "     Abre la URL y accede con tu cuenta de administrador."
echo ""
echo "  2. Configure SMTP, SES and other settings in Settings → ..."
echo "     Configura SMTP, SES y otros ajustes en Configuración."
echo ""
echo "  3. View logs / Ver logs:"
echo "       docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo -e "  ${YELLOW}⚠  Keep .env secret — it contains your credentials.${RESET}"
echo -e "  ${YELLOW}⚠  Mantén .env seguro — contiene tus credenciales.${RESET}"
echo ""
