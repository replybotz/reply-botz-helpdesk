#!/usr/bin/env bash
# ============================================================
# Reply Botz HD — One-command development environment setup
# Usage: bash scripts/setup-dev.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; exit 1; }
header()  { echo -e "\n${BOLD}${BLUE}── $1 ──────────────────────────────────${NC}"; }

# ─── Check prerequisites ──────────────────────────────────────
header "Checking prerequisites"

command -v docker >/dev/null 2>&1 || error "Docker not found. Install from https://docs.docker.com/get-docker/"
command -v node >/dev/null 2>&1   || error "Node.js not found. Install from https://nodejs.org/"
command -v pnpm >/dev/null 2>&1   || { warn "pnpm not found. Installing..."; npm install -g pnpm; }

DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
NODE_VERSION=$(node --version | grep -oE '[0-9]+' | head -1)

success "Docker $DOCKER_VERSION"
success "Node.js $(node --version)"
success "pnpm $(pnpm --version)"

# Verify docker daemon is running
docker info >/dev/null 2>&1 || error "Docker daemon is not running. Start Docker Desktop."

# ─── Environment setup ───────────────────────────────────────
header "Environment configuration"

if [ ! -f .env ]; then
  cp .env.example .env
  success "Created .env from .env.example"

  # Generate secrets automatically
  JWT_ACCESS=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  JWT_REFRESH=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  ENCRYPTION=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

  # Replace placeholder values in .env
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|JWT_ACCESS_SECRET=CHANGE_ME.*|JWT_ACCESS_SECRET=${JWT_ACCESS}|" .env
    sed -i '' "s|JWT_REFRESH_SECRET=CHANGE_ME.*|JWT_REFRESH_SECRET=${JWT_REFRESH}|" .env
    sed -i '' "s|ENCRYPTION_KEY=CHANGE_ME.*|ENCRYPTION_KEY=${ENCRYPTION}|" .env
  else
    sed -i "s|JWT_ACCESS_SECRET=CHANGE_ME.*|JWT_ACCESS_SECRET=${JWT_ACCESS}|" .env
    sed -i "s|JWT_REFRESH_SECRET=CHANGE_ME.*|JWT_REFRESH_SECRET=${JWT_REFRESH}|" .env
    sed -i "s|ENCRYPTION_KEY=CHANGE_ME.*|ENCRYPTION_KEY=${ENCRYPTION}|" .env
  fi

  success "Generated JWT secrets and encryption key"
else
  info ".env already exists, skipping"
fi

# ─── Install dependencies ────────────────────────────────────
header "Installing dependencies"
pnpm install
success "Dependencies installed"

# ─── Start Docker services ───────────────────────────────────
header "Starting Docker services"
docker compose up -d
success "Docker services started"

echo ""
info "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose exec -T db pg_isready -U postgres -d helpdesk >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -eq 0 ]; then
    error "PostgreSQL did not become ready in time. Run: docker compose logs db"
  fi
  sleep 2
done
success "PostgreSQL is ready"

# ─── Database setup ──────────────────────────────────────────
header "Setting up database"

info "Running migrations..."
(cd apps/api && npx prisma migrate deploy)
success "Migrations applied"

info "Seeding database..."
(cd apps/api && npx prisma db seed)
success "Database seeded"

# ─── Done ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   Reply Botz HD is ready!                            ║${NC}"
echo -e "${BOLD}${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}${GREEN}║                                                      ║${NC}"
echo -e "${BOLD}${GREEN}║   Run:  pnpm run dev                                 ║${NC}"
echo -e "${BOLD}${GREEN}║                                                      ║${NC}"
echo -e "${BOLD}${GREEN}║   Web App  →  http://localhost:3000                  ║${NC}"
echo -e "${BOLD}${GREEN}║   API      →  http://localhost:3001                  ║${NC}"
echo -e "${BOLD}${GREEN}║   API Docs →  http://localhost:3001/api/docs         ║${NC}"
echo -e "${BOLD}${GREEN}║   MailHog  →  http://localhost:8025                  ║${NC}"
echo -e "${BOLD}${GREEN}║                                                      ║${NC}"
echo -e "${BOLD}${GREEN}║   Login:  admin@example.com / Admin@123456!          ║${NC}"
echo -e "${BOLD}${GREEN}║                                                      ║${NC}"
echo -e "${BOLD}${GREEN}║   See TESTING.md for full testing guide              ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
