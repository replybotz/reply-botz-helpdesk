import { prisma } from './db';
import type { Prisma } from '@/generated/prisma';

export async function audit(params: {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Prisma.InputJsonValue;
  ipAddress?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      changes: params.changes ?? {},
      ipAddress: params.ipAddress,
    },
  });
}
