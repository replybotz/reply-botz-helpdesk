# Reply Botz HD — Testing Environment Setup

This guide walks through starting the full application stack locally for development and testing.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | ≥ 24.x | https://docs.docker.com/get-docker/ |
| Node.js | ≥ 20.x | https://nodejs.org/ |
| pnpm | ≥ 8.x | `npm install -g pnpm` |
| make | any | pre-installed on macOS/Linux; Windows: use Git Bash |

---

## Quick Start (5 minutes)

```bash
# 1. Clone / navigate to the project
cd reply-botz-helpdesk

# 2. Copy environment template and configure secrets
cp .env.example .env

# 3. Generate required secrets (copy each output value into .env)
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# 4. Install dependencies
pnpm install

# 5. Start infrastructure services (PostgreSQL, Redis, Qdrant, MailHog)
docker compose up -d

# 6. Run database migrations
cd apps/api && npx prisma migrate deploy && cd ../..

# 7. Seed default data
cd apps/api && npx prisma db seed && cd ../..

# 8. Start the application
pnpm run dev
```

The app will be available at **http://localhost:3000**.

---

## Step-by-Step Details

### Step 1 — Configure Environment Variables

Open `.env` and set the following **required** fields:

```env
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=<your-256-bit-hex-secret>
JWT_REFRESH_SECRET=<your-different-256-bit-hex-secret>

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<your-64-hex-char-key>
```

All other values have working defaults for local development. AI features (chat, KB generation) require optional API keys:

```env
OPENAI_API_KEY=sk-...        # For AI chat + content moderation
ANTHROPIC_API_KEY=sk-ant-... # Alternative AI provider
```

### Step 2 — Start Docker Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** with pgvector extension → `localhost:5432`
- **Redis 7** → `localhost:6379`
- **Qdrant** (vector search) → `localhost:6333`
- **MailHog** (email capture) → `localhost:1025` (SMTP) / `localhost:8025` (Web UI)

Verify all services are healthy:

```bash
docker compose ps
# All services should show status "healthy" or "running"
```

### Step 3 — Database Setup

```bash
# Apply migrations (creates all tables)
cd apps/api
npx prisma migrate deploy

# Seed default organization and admin user
npx prisma db seed
cd ../..
```

Seed creates:
- Organization: `Reply Botz HD Demo` (slug: `default`)
- Admin user: `admin@example.com` / `Admin@123456!`
- Default ticket categories (8)
- Default KB categories (8)
- Content moderation policies (4 age groups)

### Step 4 — Start Application

**Option A — All services together (recommended):**
```bash
pnpm run dev
# Uses Turborepo to start API + Web in parallel
```

**Option B — Separately:**
```bash
# Terminal 1 — NestJS API
pnpm --filter @reply-botz/api run dev

# Terminal 2 — Next.js Web
pnpm --filter @reply-botz/web run dev
```

---

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Web App** | http://localhost:3000 | Main application UI |
| **API** | http://localhost:3001 | NestJS REST API |
| **API Docs** | http://localhost:3001/api/docs | Swagger/OpenAPI |
| **MailHog** | http://localhost:8025 | Captured outbound emails |
| **Prisma Studio** | http://localhost:5555 | Database browser (run `make db-studio`) |
| **Qdrant** | http://localhost:6333/dashboard | Vector DB dashboard |

---

## Default Login

| Field | Value |
|-------|-------|
| URL | http://localhost:3000/login |
| Email | `admin@example.com` |
| Password | `Admin@123456!` |
| Role | `SUPER_ADMIN` |

---

## Testing Specific Features

### Authentication
1. Go to http://localhost:3000/login
2. Login with `admin@example.com` / `Admin@123456!`
3. Verify you land on the Dashboard overview
4. Test token refresh: wait 15 minutes (or manually expire via Redis)
5. Test logout: click profile menu → Logout

### MFA Setup
1. Login → navigate to **Security** in the sidebar
2. Click **Enable MFA**
3. Scan the QR code with an authenticator app (Google Authenticator, Authy)
4. Enter the 6-digit code to verify
5. Save the backup codes shown
6. Logout and login again — MFA prompt should appear

### Creating a Ticket
1. Navigate to **Tickets** → **New Ticket**
2. Fill in subject, description, select a category
3. Assign to yourself
4. Submit and verify it appears in the ticket list

### Knowledge Base
1. Navigate to **Knowledge Base**
2. Click **New Article**
3. Create a draft article
4. Click **Publish** to make it live
5. Test the edit/archive actions on the detail page

### AI Chat (requires API key)
Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`, then restart the API:
```bash
docker compose restart api
# OR if running locally:
# Restart your 'pnpm dev' process
```

### Email Testing
All outbound emails (password reset, MFA codes, notifications) are captured by MailHog.
View them at http://localhost:8025 — no real emails are sent in development.

### LMS Integrations
1. Navigate to **LMS Integrations**
2. Select a platform (e.g., Canvas) and enter connection details
3. Click **Test Connection** — returns mock success in development
4. Click **Sync Now** to trigger a background sync job

---

## Useful Make Commands

```bash
make help          # Show all available commands
make status        # Check Docker service health
make logs-api      # Tail API logs
make logs-web      # Tail Web logs
make db-studio     # Open Prisma Studio database browser
make db-shell      # psql shell into PostgreSQL
make type-check    # TypeScript compilation check (both apps)
make db-reset      # Drop + recreate DB + migrate + seed (destructive!)
make reset         # Full environment reset (destructive!)
```

---

## Troubleshooting

### "Database connection refused"
```bash
# Check DB is healthy
docker compose ps db
# If not healthy, check logs
docker compose logs db
# Restart if needed
docker compose restart db
```

### "Prisma migration failed"
```bash
# Verify DATABASE_URL in .env matches Docker compose settings
grep DATABASE_URL .env
# Should be: postgresql://postgres:<DB_PASSWORD>@localhost:5432/helpdesk
# DB_PASSWORD defaults to: helpdesk_dev_password
```

### "Redis connection error"
```bash
docker compose restart redis
```

### "Port already in use"
```bash
# Check what's using the port
lsof -i :3000  # or :3001, :5432, :6379
# Kill the process or change ports in docker-compose.yml + .env
```

### "pnpm: command not found"
```bash
npm install -g pnpm
```

### API returns 401 on all requests
The JWT secrets in `.env` must be set. If they're still the default `CHANGE_ME_...` values, generate real secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Update `.env` and restart the API.

### Next.js build errors
```bash
cd apps/web && npx tsc --noEmit
# Fix any TypeScript errors shown, then retry pnpm dev
```

---

## Running Tests

```bash
# All tests
pnpm run test

# API tests only
pnpm --filter @reply-botz/api run test

# API tests with coverage
pnpm --filter @reply-botz/api run test:cov

# TypeScript type check
make type-check
```

---

## Docker-Only Mode

If you prefer to run everything in Docker (no local Node.js required):

```bash
# Start all services including API and Web containers
docker compose up

# The API and Web Dockerfiles handle migrations on startup:
# api command: "npx prisma migrate deploy && npm run dev"

# Then seed (in a new terminal):
docker compose exec api npx prisma db seed
```

Note: Hot reload works in Docker mode via volume mounts (`./apps/api/src:/app/src`).

---

## Project Structure

```
reply-botz-helpdesk/
├── apps/
│   ├── api/          NestJS backend (port 3001)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           JWT, OAuth2, MFA
│   │   │   │   ├── users/          User management + roles
│   │   │   │   ├── organizations/  Multi-tenancy
│   │   │   │   ├── conversations/  Real-time chat + WebSocket
│   │   │   │   ├── tickets/        Support ticket system
│   │   │   │   ├── customers/      Customer profiles
│   │   │   │   ├── knowledge-base/ KB articles + vector search
│   │   │   │   ├── ai-gateway/     Multi-provider LLM abstraction
│   │   │   │   ├── lms-integrations/ Canvas, Moodle, Google Classroom, etc.
│   │   │   │   ├── content-moderation/ Age-appropriate filtering
│   │   │   │   ├── ferpa-compliance/   Audit logging + encryption
│   │   │   │   └── analytics/      Dashboard metrics
│   │   │   └── shared/
│   │   │       ├── database/       Prisma service
│   │   │       ├── cache/          Redis service
│   │   │       └── queue/          BullMQ background jobs
│   │   └── prisma/
│   │       ├── schema.prisma       24-model database schema
│   │       ├── migrations/         Versioned SQL migrations
│   │       └── seed.ts             Default data seeder
│   └── web/          Next.js 14 frontend (port 3000)
│       └── src/app/dashboard/
│           ├── page.tsx            Overview / metrics
│           ├── conversations/      Real-time chat threads
│           ├── tickets/            Support ticket management
│           ├── customers/          Customer profiles
│           ├── knowledge-base/     KB article management
│           ├── analytics/          Charts + reports
│           └── settings/
│               ├── lms/            LMS platform connections
│               ├── ai/             AI provider configuration
│               ├── ferpa/          Compliance + audit log
│               ├── users/          Team member management
│               └── security/       MFA setup
├── packages/
│   └── shared-types/ Shared TypeScript interfaces + enums
├── docker-compose.yml
├── Makefile          Dev convenience commands
└── .env.example      Environment variable reference
```
