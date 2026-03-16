# ============================================================
# Reply Botz HD — Development Makefile
# Usage: make <target>
# ============================================================

.PHONY: help setup up down restart logs db-migrate db-seed db-reset \
        dev dev-api dev-web build test lint type-check clean status

# Default target
help:
	@echo ""
	@echo "  Reply Botz HD — Development Commands"
	@echo "  ─────────────────────────────────────────────────────"
	@echo "  Setup & Start"
	@echo "    make setup        Copy .env.example → .env, install deps"
	@echo "    make up           Start all Docker services (detached)"
	@echo "    make down         Stop all Docker services"
	@echo "    make restart      Restart all Docker services"
	@echo "    make status       Show running service status"
	@echo ""
	@echo "  Database"
	@echo "    make db-migrate   Run Prisma migrations"
	@echo "    make db-seed      Seed default org + admin user"
	@echo "    make db-reset     Drop + recreate DB, migrate, seed"
	@echo "    make db-studio    Open Prisma Studio (DB browser)"
	@echo "    make db-shell     Open psql shell"
	@echo ""
	@echo "  Development"
	@echo "    make dev          Start API + Web dev servers (foreground)"
	@echo "    make dev-api      Start only the NestJS API (hot reload)"
	@echo "    make dev-web      Start only the Next.js Web app"
	@echo ""
	@echo "  Quality"
	@echo "    make build        Build both apps for production"
	@echo "    make test         Run all tests"
	@echo "    make lint         Run ESLint across all workspaces"
	@echo "    make type-check   Run TypeScript compiler check"
	@echo ""
	@echo "  Utilities"
	@echo "    make logs         Tail Docker service logs"
	@echo "    make logs-api     Tail API container logs"
	@echo "    make logs-web     Tail Web container logs"
	@echo "    make clean        Remove node_modules + build artifacts"
	@echo "    make reset        Full reset (down + clean + setup + up + db-reset)"
	@echo ""

# ─── Setup ──────────────────────────────────────────────────

setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Created .env from .env.example"; \
		echo "⚠️  Edit .env and set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY"; \
	else \
		echo "ℹ️  .env already exists, skipping copy"; \
	fi
	@echo "📦 Installing dependencies..."
	pnpm install
	@echo "✅ Setup complete. Run 'make up' then 'make db-migrate db-seed'"

# ─── Docker ─────────────────────────────────────────────────

up:
	docker compose up -d
	@echo "✅ Services started. Waiting for health checks..."
	@sleep 5
	@docker compose ps

down:
	docker compose down

restart:
	docker compose restart

status:
	docker compose ps

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-web:
	docker compose logs -f web

logs-db:
	docker compose logs -f db

# ─── Database ────────────────────────────────────────────────

db-migrate:
	@echo "🔄 Running Prisma migrations..."
	cd apps/api && npx prisma migrate deploy
	@echo "✅ Migrations applied"

db-seed:
	@echo "🌱 Seeding database..."
	cd apps/api && npx prisma db seed
	@echo "✅ Seed complete"
	@echo "   👤 admin@example.com / Admin@123456!"

db-reset:
	@echo "⚠️  Resetting database (drop + migrate + seed)..."
	cd apps/api && npx prisma migrate reset --force
	@echo "✅ Database reset complete"

db-generate:
	cd apps/api && npx prisma generate

db-studio:
	@echo "🔍 Opening Prisma Studio on http://localhost:5555"
	cd apps/api && npx prisma studio

db-shell:
	docker compose exec db psql -U postgres -d helpdesk

# ─── Development Servers ────────────────────────────────────

dev:
	@echo "🚀 Starting API + Web dev servers..."
	@echo "   API → http://localhost:3001"
	@echo "   Web → http://localhost:3000"
	pnpm run dev

dev-api:
	@echo "🚀 Starting NestJS API on http://localhost:3001"
	pnpm --filter @reply-botz/api run dev

dev-web:
	@echo "🚀 Starting Next.js Web on http://localhost:3000"
	pnpm --filter @reply-botz/web run dev

# ─── Quality ─────────────────────────────────────────────────

build:
	pnpm run build

test:
	pnpm run test

lint:
	pnpm run lint

type-check:
	@echo "🔍 Type-checking API..."
	cd apps/api && npx tsc --noEmit
	@echo "🔍 Type-checking Web..."
	cd apps/web && npx tsc --noEmit
	@echo "✅ Type check passed"

# ─── Cleanup ─────────────────────────────────────────────────

clean:
	@echo "🗑️  Removing node_modules and build artifacts..."
	find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name ".next" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Clean complete"

reset: down clean setup up
	@sleep 10
	$(MAKE) db-reset
	@echo "✅ Full reset complete. App available at http://localhost:3000"
