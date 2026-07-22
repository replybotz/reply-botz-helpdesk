import type { TenantPlan, TenantStatus } from '@/generated/prisma';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: TenantPlan;
  status: TenantStatus;
  settings: Record<string, unknown>;
}
