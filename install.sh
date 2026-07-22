#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Reply Botz HD - Docker Install Script
# ============================================
# Usage:
#   chmod +x install.sh && ./install.sh
#
# Options:
#   --dev       Start in development mode (hot reload)
#   --prod      Start in production mode (default)
#   --monitoring  Include Prometheus, Grafana, Loki
#   --gui       Launch browser-based GUI installer
#   --down      Stop all services
#   --reset     Stop all services and destroy volumes
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

MODE="prod"
MONITORING=false

for arg in "$@"; do
  case $arg in
    --dev) MODE="dev" ;;
    --prod) MODE="prod" ;;
    --monitoring) MONITORING=true ;;
    --down)
      echo -e "${CYAN}Stopping all services...${NC}"
      # Dummy values keep compose's ${VAR:?} interpolation happy when .env
      # is absent — `down` doesn't use them.
      POSTGRES_PASSWORD=x REDIS_PASSWORD=x MEILI_MASTER_KEY=x GRAFANA_PASSWORD=x \
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down
      echo -e "${GREEN}Done.${NC}"
      exit 0
      ;;
    --reset)
      echo -e "${RED}WARNING: This will destroy all data (database, cache, search index).${NC}"
      read -rp "Are you sure? (y/N): " confirm
      if [[ "$confirm" =~ ^[Yy]$ ]]; then
        POSTGRES_PASSWORD=x REDIS_PASSWORD=x MEILI_MASTER_KEY=x GRAFANA_PASSWORD=x \
          docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
        rm -f .installed
        echo -e "${GREEN}All services stopped and volumes removed.${NC}"
      fi
      exit 0
      ;;
    --gui)
      echo -e "${CYAN}Launching GUI installer...${NC}"
      if ! command -v node &>/dev/null; then
        echo -e "${RED}Error: Node.js is required for the GUI installer.${NC}"
        echo "Install Node.js 20+: https://nodejs.org/"
        exit 1
      fi
      exec node "$(dirname "$0")/installer/server.js"
      ;;
    --help|-h)
      echo "Usage: ./install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dev          Development mode (hot reload, no nginx/ssl)"
      echo "  --prod         Production mode (default)"
      echo "  --monitoring   Include Prometheus + Grafana + Loki"
      echo "  --gui          Launch browser-based GUI installer"
      echo "  --down         Stop all services"
      echo "  --reset        Stop services and destroy all data"
      echo "  -h, --help     Show this help"
      exit 0
      ;;
  esac
done

echo -e "${CYAN}"
echo "  ____            _         ____        _          _   _ ____  "
echo " |  _ \\ ___ _ __ | |_   _  | __ )  ___ | |_ ____  | | | |  _ \\ "
echo " | |_) / _ \\ '_ \\| | | | | |  _ \\ / _ \\| __|_  /  | |_| | | | |"
echo " |  _ <  __/ |_) | | |_| | | |_) | (_) | |_ / /   |  _  | |_| |"
echo " |_| \\_\\___| .__/|_|\\__, | |____/ \\___/ \\__/___|  |_| |_|____/ "
echo "           |_|      |___/                                       "
echo -e "${NC}"
echo -e "${GREEN}AI-Powered Helpdesk Platform${NC}"
echo ""

# ---------------------------
# 1. Check prerequisites
# ---------------------------
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v docker &>/dev/null; then
  echo -e "${RED}Error: Docker is not installed.${NC}"
  echo "Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo -e "${RED}Error: Docker Compose V2 is not available.${NC}"
  echo "Update Docker or install the compose plugin."
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo -e "${RED}Error: Docker daemon is not running.${NC}"
  echo "Start Docker and try again."
  exit 1
fi

echo -e "${GREEN}  Docker $(docker --version | grep -oP '\d+\.\d+\.\d+') detected${NC}"
echo -e "${GREEN}  Docker Compose $(docker compose version --short) detected${NC}"

# ---------------------------
# 2. Generate .env
# ---------------------------
# Docker Compose interpolates ${VAR} placeholders from `.env` specifically,
# so the config must live there for service passwords to line up with the
# values the app reads.
echo ""
echo -e "${YELLOW}[2/5] Configuring environment...${NC}"

if [ -f .env.local ] && [ ! -f .env ]; then
  mv .env.local .env
  echo -e "  ${YELLOW}Migrated legacy .env.local to .env${NC}"
fi

if [ -f .env ]; then
  echo -e "  ${GREEN}.env already exists, keeping existing config${NC}"
else
  # Generate secure random values. Passwords use hex (not base64) because
  # they are embedded in DATABASE_URL/REDIS_URL, where '/', '+', '=' would
  # break URL parsing.
  JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -d '\n' | head -c 64)
  ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)
  POSTGRES_PASSWORD=$(openssl rand -hex 18 2>/dev/null || head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
  REDIS_PASSWORD=$(openssl rand -hex 18 2>/dev/null || head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
  MEILI_MASTER_KEY=$(openssl rand -hex 18 2>/dev/null || head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
  GRAFANA_PASSWORD=$(openssl rand -hex 12 2>/dev/null || head -c 16 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 16)

  if [ "$MODE" = "dev" ]; then
    NODE_ENV_VALUE="development"
  else
    NODE_ENV_VALUE="production"
  fi

  umask 177
  cat > .env <<EOF
# ===========================================
# Reply Botz HD - Generated Configuration
# Generated on: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ===========================================

# App
NODE_ENV=${NODE_ENV_VALUE}
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_DOMAIN=replybotz.localhost

# Database (PostgreSQL)
DATABASE_URL=postgresql://replybotz:${POSTGRES_PASSWORD}@postgres:5432/replybotz
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# Auth (JWT) - Auto-generated secure secret
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Password Hashing (Argon2)
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3

# MFA (TOTP)
MFA_ISSUER=ReplyBotzHD

# Encryption (AES-256-GCM) - Auto-generated secure key
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Meilisearch
MEILI_URL=http://meilisearch:7700
MEILI_MASTER_KEY=${MEILI_MASTER_KEY}
MEILI_ENV=${NODE_ENV_VALUE}

# Monitoring
GRAFANA_PASSWORD=${GRAFANA_PASSWORD}

# Logging
LOG_LEVEL=info

# Tenant Resolution
TENANT_RESOLUTION_MODE=subdomain
EOF
  umask 022

  echo -e "  ${GREEN}.env generated with secure random secrets (mode 600)${NC}"
fi

# Values needed later (e.g. Redis health check)
REDIS_PASSWORD_VALUE=$(grep -E '^REDIS_PASSWORD=' .env | cut -d= -f2- | tr -d '"')

# ---------------------------
# 3. Build and start services
# ---------------------------
echo ""
echo -e "${YELLOW}[3/5] Starting services (${MODE} mode)...${NC}"

COMPOSE_FILES="-f docker-compose.yml"
PROFILES=""

if [ "$MODE" = "dev" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.dev.yml"
  echo -e "  ${CYAN}Dev mode: hot reload enabled, nginx/ssl disabled${NC}"
fi

if [ "$MONITORING" = true ]; then
  PROFILES="--profile monitoring"
  echo -e "  ${CYAN}Monitoring: Prometheus + Grafana + Loki enabled${NC}"
fi

# Pull images and build
echo -e "  Pulling images..."
docker compose $COMPOSE_FILES pull --quiet 2>/dev/null || true

echo -e "  Building application..."
docker compose $COMPOSE_FILES $PROFILES up -d --build 2>&1 | tail -5

# ---------------------------
# 4. Wait for services
# ---------------------------
echo ""
echo -e "${YELLOW}[4/5] Waiting for services to be healthy...${NC}"

# Wait for PostgreSQL
echo -n "  PostgreSQL: "
for i in $(seq 1 30); do
  if docker compose $COMPOSE_FILES exec -T postgres pg_isready -U replybotz -d replybotz &>/dev/null; then
    echo -e "${GREEN}ready${NC}"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo -e "${RED}timeout${NC}"
    echo -e "${RED}PostgreSQL failed to start. Check logs: docker compose logs postgres${NC}"
    exit 1
  fi
  sleep 1
done

# Wait for Redis (redis-server runs with --requirepass)
echo -n "  Redis: "
for i in $(seq 1 15); do
  if docker compose $COMPOSE_FILES exec -T redis redis-cli -a "$REDIS_PASSWORD_VALUE" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}ready${NC}"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo -e "${RED}timeout${NC}"
    echo -e "${RED}Redis failed to start. Check logs: docker compose logs redis${NC}"
    exit 1
  fi
  sleep 1
done

# ---------------------------
# 5. Run database migrations + seed
# ---------------------------
# The `migrate` compose service runs in the builder-stage image, which has
# the Prisma CLI and tsx (the standalone production image does not).
echo ""
echo -e "${YELLOW}[5/5] Running database setup...${NC}"
docker compose $COMPOSE_FILES run --rm migrate 2>&1 | tail -5

# Wait for app
echo -n "  Application: "
for i in $(seq 1 60); do
  if curl -sf http://localhost:3000/api/health &>/dev/null; then
    echo -e "${GREEN}ready${NC}"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo -e "${YELLOW}still starting (check: docker compose logs app)${NC}"
  fi
  sleep 2
done

date -u +"%Y-%m-%dT%H:%M:%SZ" > .installed

# ---------------------------
# Done!
# ---------------------------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Reply Botz HD is running!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  ${CYAN}App:${NC}          http://localhost:3000"
echo -e "  ${CYAN}Health:${NC}       http://localhost:3000/api/health"
echo -e "  ${CYAN}Meilisearch:${NC}  http://localhost:7700"

if [ "$MONITORING" = true ]; then
  echo -e "  ${CYAN}Grafana:${NC}      http://localhost:3001"
  echo -e "  ${CYAN}Prometheus:${NC}   http://localhost:9090"
fi

if [ "$MODE" = "prod" ]; then
  echo -e "  ${CYAN}Nginx:${NC}        http://localhost:80"
fi

SEED_EMAIL=$(grep -E '^SEED_ADMIN_EMAIL=' .env | cut -d= -f2- | tr -d '"' || true)
echo ""
echo -e "  ${YELLOW}Default login:${NC}"
echo -e "    Email:    ${SEED_EMAIL:-admin@replybotz.com}"
echo -e "    Password: (SEED_ADMIN_PASSWORD from .env, or Admin@123456 if unset — CHANGE IT)"
echo -e "    Tenant:   system"
echo ""
echo -e "  ${YELLOW}Demo login:${NC}"
echo -e "    Email:    admin@demo.com"
echo -e "    Password: (same as default login)"
echo -e "    Tenant:   demo"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo -e "    Logs:     docker compose logs -f app"
echo -e "    Stop:     ./install.sh --down"
echo -e "    Reset:    ./install.sh --reset"
echo ""
