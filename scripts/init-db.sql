-- Initialize PostgreSQL extensions required by Reply Botz HD
-- This script runs on first database creation

-- Enable pgcrypto for column-level encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Note: pgvector extension is provided by the pgvector/pgvector Docker image
-- and is enabled via Prisma schema's previewFeatures = ["postgresqlExtensions"]

-- Set timezone to UTC for consistency
SET timezone = 'UTC';

-- Create helpdesk database if running against default postgres database
-- (Not needed when POSTGRES_DB=helpdesk is set in Docker Compose)

COMMENT ON DATABASE helpdesk IS 'Reply Botz HD - EdTech Support Platform';
