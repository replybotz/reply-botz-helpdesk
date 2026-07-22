# Reply Botz HD - AI-First Helpdesk System

An open-source (MIT), AI-first helpdesk platform with multi-channel support, multi-tenancy, and white-label capabilities.

## Features

- **AI Chat System** - Real-time AI-powered chat with multi-channel support
- **AI Ticket/Email System** - Automated classification, routing, and SLA management
- **AI Voice Agents** - Phone and web-based voice support
- **Knowledge Base** - Self-learning article generation from interactions
- **AI Model Management** - BYOK support for multiple AI providers
- **Human Handoff** - Seamless AI-to-human escalation
- **White-Label** - Full branding customization
- **Multi-Tenant** - Isolated data with shared infrastructure

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis
- **Search**: Meilisearch
- **UI**: Tailwind CSS + shadcn/ui
- **Auth**: Custom JWT + Argon2 + TOTP MFA
- **Queue**: BullMQ
- **Monitoring**: Prometheus + Grafana + Loki

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### Guided Install (recommended)

```bash
# Terminal installer — generates .env, starts Docker services, migrates + seeds
./install.sh            # production mode
./install.sh --dev      # development mode (hot reload)

# Or the browser-based wizard
./install.sh --gui
```

### Development Setup (manual)

```bash
# Install dependencies
npm install

# Copy environment config (Docker Compose reads ${VAR} values from .env)
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

### Docker Setup (manual)

```bash
# Copy environment config and fill in real secrets
cp .env.example .env

# Start all services
docker compose up -d

# Run migrations + seed (one-shot service with the Prisma CLI)
docker compose run --rm migrate

# For development (hot reload, no nginx/ssl)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Seeded logins default to `admin@replybotz.com` (tenant `system`) and
`admin@demo.com` (tenant `demo`); set `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` in `.env` before seeding to override.

### Checks

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # jest (node + jsdom projects)
```

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # React components
├── lib/              # Core library code
│   ├── auth/         # JWT, password hashing, MFA, sessions
│   ├── tenant/       # Multi-tenant context, middleware, RLS
│   └── rbac/         # Permissions, roles, route guards
├── types/            # TypeScript type definitions
└── proxy.ts          # Next.js proxy (edge auth gate; middleware was renamed in Next 16)
```

## Architecture

- **Multi-tenant**: Row-level data isolation with `tenant_id` on every table
- **RBAC**: 5 roles (Super Admin, Tenant Admin, Supervisor, Agent, Customer) with 30+ granular permissions
- **Auth**: Custom JWT with access/refresh token rotation, MFA support
- **Security**: AES-256-GCM encryption for API keys, Argon2id password hashing

## License

MIT License - see [LICENSE](LICENSE) for details.
