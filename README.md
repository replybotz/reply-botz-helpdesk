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

### Development Setup

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

### Docker Setup

```bash
# Copy environment config
cp .env.example .env.local

# Start all services
docker compose up -d

# For development (without nginx/monitoring)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
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
└── middleware.ts      # Next.js edge middleware
```

## Architecture

- **Multi-tenant**: Row-level data isolation with `tenant_id` on every table
- **RBAC**: 5 roles (Super Admin, Tenant Admin, Supervisor, Agent, Customer) with 30+ granular permissions
- **Auth**: Custom JWT with access/refresh token rotation, MFA support
- **Security**: AES-256-GCM encryption for API keys, Argon2id password hashing

## License

MIT License - see [LICENSE](LICENSE) for details.
