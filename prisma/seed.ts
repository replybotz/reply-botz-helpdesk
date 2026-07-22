import { PrismaClient } from '../src/generated/prisma';
import argon2 from 'argon2';

const prisma = new PrismaClient();

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
      emailVerifiedAt: new Date(),
    },
  });

  console.warn(`Super admin created/found: ${admin.id} (${admin.email})`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn('Using the default admin password (Admin@123456) — CHANGE THIS IMMEDIATELY');
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
