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
      docker compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true
      echo -e "${GREEN}Done.${NC}"
      exit 0
      ;;
    --reset)
      echo -e "${RED}WARNING: This will destroy all data (database, cache, search index).${NC}"
      read -rp "Are you sure? (y/N): " confirm
      if [[ "$confirm" =~ ^[Yy]$ ]]; then
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v 2>/dev/null || true
        echo -e "${GREEN}All services stopped and volumes removed.${NC}"
      fi
      exit 0
      ;;
    --help|-h)
      echo "Usage: ./install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dev          Development mode (hot reload, no nginx/ssl)"
      echo "  --prod         Production mode (default)"
      echo "  --monitoring   Include Prometheus + Grafana + Loki"
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
# 2. Generate .env.local
# ---------------------------
echo ""
echo -e "${YELLOW}[2/5] Configuring environment...${NC}"

if [ -f .env.local ]; then
  echo -e "  ${GREEN}.env.local already exists, keeping existing config${NC}"
else
  # Generate secure random values
  JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -d '\n' | head -c 64)
  ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)
  POSTGRES_PASSWORD=$(openssl rand -base64 24 2>/dev/null || head -c 24 /dev/urandom | base64 | tr -d '\n/+=' | head -c 24)
  REDIS_PASSWORD=$(openssl rand -base64 24 2>/dev/null || head -c 24 /dev/urandom | base64 | tr -d '\n/+=' | head -c 24)
  MEILI_MASTER_KEY=$(openssl rand -base64 24 2>/dev/null || head -c 24 /dev/urandom | base64 | tr -d '\n/+=' | head -c 24)
  GRAFANA_PASSWORD=$(openssl rand -base64 16 2>/dev/null || head -c 16 /dev/urandom | base64 | tr -d '\n/+=' | head -c 16)

  cat > .env.local <<EOF
# ===========================================
# Reply Botz HD - Generated Configuration
# Generated on: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ===========================================

# App
NODE_ENV=${MODE}
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

# Monitoring
GRAFANA_PASSWORD=${GRAFANA_PASSWORD}

# Logging
LOG_LEVEL=info

# Tenant Resolution
TENANT_RESOLUTION_MODE=subdomain
EOF

  echo -e "  ${GREEN}.env.local generated with secure random secrets${NC}"
fi

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

# Wait for Redis
echo -n "  Redis: "
for i in $(seq 1 15); do
  if docker compose $COMPOSE_FILES exec -T redis redis-cli ping &>/dev/null; then
    echo -e "${GREEN}ready${NC}"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo -e "${RED}timeout${NC}"
  fi
  sleep 1
done

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

# ---------------------------
# 5. Run database migrations
# ---------------------------
echo ""
echo -e "${YELLOW}[5/5] Running database setup...${NC}"

if [ "$MODE" = "dev" ]; then
  docker compose $COMPOSE_FILES exec -T app sh -c "npx prisma migrate dev --name init 2>/dev/null || npx prisma db push" 2>&1 | tail -3
  echo -e "  Seeding database..."
  docker compose $COMPOSE_FILES exec -T app npx prisma db seed 2>&1 | tail -3
else
  docker compose $COMPOSE_FILES exec -T app sh -c "npx prisma migrate deploy 2>/dev/null || npx prisma db push" 2>&1 | tail -3
  echo -e "  Seeding database..."
  docker compose $COMPOSE_FILES exec -T app npx prisma db seed 2>&1 | tail -3
fi

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

echo ""
echo -e "  ${YELLOW}Default login:${NC}"
echo -e "    Email:    admin@system.replybotz.local"
echo -e "    Password: Admin@123456"
echo -e "    Tenant:   system"
echo ""
echo -e "  ${YELLOW}Demo login:${NC}"
echo -e "    Email:    admin@demo.replybotz.local"
echo -e "    Password: Admin@123456"
echo -e "    Tenant:   demo"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo -e "    Logs:     docker compose logs -f app"
echo -e "    Stop:     ./install.sh --down"
echo -e "    Reset:    ./install.sh --reset"
echo ""
