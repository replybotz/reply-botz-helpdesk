import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';

// Prisma 7 requires an explicit driver adapter — a bare `new PrismaClient()`
// throws at construction.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // Create system tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'system' },
    update: {},
    create: {
      name: 'System',
      slug: 'system',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      settings: {},
    },
  });

  console.warn(`System tenant created/found: ${tenant.id}`);

  // Create super admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@replybotz.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  // When no password was supplied the account ships with a publicly known
  // credential, so force a change at first sign-in.
  const usingDefaultPassword = !process.env.SEED_ADMIN_PASSWORD;
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash,
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      mustChangePassword: usingDefaultPassword,
      emailVerifiedAt: new Date(),
    },
  });

  console.warn(`Super admin created/found: ${admin.id} (${admin.email})`);
  if (usingDefaultPassword) {
    console.warn(
      'Using the default admin password (Admin@123456) — a password change is required at first sign-in.',
    );
  }

  // Create a demo tenant
  const demo = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      settings: {},
    },
  });

  console.warn(`Demo tenant created/found: ${demo.id}`);

  const demoAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenantId: demo.id,
      email: 'admin@demo.com',
      passwordHash,
      displayName: 'Demo Admin',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      mustChangePassword: usingDefaultPassword,
      emailVerifiedAt: new Date(),
    },
  });

  console.warn(`Demo admin created/found: ${demoAdmin.id} (${demoAdmin.email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
