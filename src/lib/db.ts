import { PrismaClient } from '@/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://replybotz:changeme@localhost:5432/replybotz';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
