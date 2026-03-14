import { PrismaClient, UserRole, OrganizationPlan } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Reply Botz HD Demo',
      slug: 'default',
      plan: OrganizationPlan.PROFESSIONAL,
      settings: {
        timezone: 'UTC',
        language: 'en',
        supportEmail: 'support@example.com',
      },
    },
  });
  console.log(`✅ Organization: ${org.name} (${org.id})`);

  // Create super admin user
  const passwordHash = await argon2.hash('Admin@123456!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: 'admin@example.com',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      email: 'admin@example.com',
      name: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      passwordHash,
      isActive: true,
    },
  });
  console.log(`✅ Admin user: ${admin.email} (role: ${admin.role})`);

  // Create default content moderation policies
  const ageGroups = [
    {
      ageGroup: 'k-8',
      sensitivityLevel: 'strict',
      enabledCategories: ['harassment', 'hate', 'sexual', 'violence', 'self-harm'],
      autoEscalate: true,
      notifyParent: true,
    },
    {
      ageGroup: '9-12',
      sensitivityLevel: 'high',
      enabledCategories: ['harassment', 'hate', 'sexual', 'violence', 'self-harm'],
      autoEscalate: true,
      notifyParent: true,
    },
    {
      ageGroup: 'college',
      sensitivityLevel: 'medium',
      enabledCategories: ['harassment', 'hate', 'sexual/minors', 'violence'],
      autoEscalate: true,
      notifyParent: false,
    },
    {
      ageGroup: 'adult',
      sensitivityLevel: 'low',
      enabledCategories: ['harassment', 'hate', 'sexual/minors', 'violence/graphic'],
      autoEscalate: false,
      notifyParent: false,
    },
  ];

  for (const policy of ageGroups) {
    await prisma.contentModerationPolicy.upsert({
      where: {
        organizationId_ageGroup: {
          organizationId: org.id,
          ageGroup: policy.ageGroup,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        ...policy,
      },
    });
  }
  console.log(`✅ Content moderation policies created (4 age groups)`);

  // Create default ticket categories
  const categories = [
    { name: 'Platform Usage', description: 'How to use the platform' },
    { name: 'Account & Login', description: 'Account management and login issues' },
    { name: 'Course Access', description: 'Accessing courses and materials' },
    { name: 'Assignment Help', description: 'Help with assignments and submissions' },
    { name: 'Technical Issue', description: 'Technical problems and bugs' },
    { name: 'Billing & Payment', description: 'Billing and payment questions' },
    { name: 'LMS Integration', description: 'LMS platform integration issues' },
    { name: 'Other', description: 'Other support requests' },
  ];

  for (const cat of categories) {
    const existing = await prisma.ticketCategory.findFirst({
      where: { organizationId: org.id, name: cat.name },
    });
    if (!existing) {
      await prisma.ticketCategory.create({
        data: { organizationId: org.id, ...cat },
      });
    }
  }
  console.log(`✅ Ticket categories created (${categories.length})`);

  // Create default KB categories
  const kbCategories = [
    { name: 'Getting Started', slug: 'getting-started' },
    { name: 'Platform Features', slug: 'platform-features' },
    { name: 'LMS Guides', slug: 'lms-guides' },
    { name: 'Troubleshooting', slug: 'troubleshooting' },
    { name: 'Account Management', slug: 'account-management' },
    { name: 'For Students', slug: 'for-students' },
    { name: 'For Teachers', slug: 'for-teachers' },
    { name: 'For Parents', slug: 'for-parents' },
  ];

  for (const cat of kbCategories) {
    await prisma.kbCategory.upsert({
      where: {
        organizationId_slug: {
          organizationId: org.id,
          slug: cat.slug,
        },
      },
      update: {},
      create: { organizationId: org.id, ...cat },
    });
  }
  console.log(`✅ KB categories created (${kbCategories.length})`);

  console.log('🎉 Database seeded successfully!');
  console.log('\n📋 Default credentials:');
  console.log('   Email: admin@example.com');
  console.log('   Password: Admin@123456!');
  console.log('\n⚠️  Change these credentials before going to production!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
