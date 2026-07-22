import { Prisma } from '@/generated/prisma';

/**
 * LIMITATION: this extension scopes only TOP-LEVEL operations. Nested
 * relations reached through `include`/`select` are NOT filtered by tenantId,
 * so any client-supplied foreign key that ends up in a scoped row must be
 * validated against the tenant at the API boundary before writing (see the
 * customerId check in the conversations route).
 */
const TENANT_SCOPED_MODELS = [
  'User',
  'Conversation',
  'Ticket',
  'KnowledgeBaseArticle',
  'AiConfiguration',
  'Integration',
  'AuditLog',
];

export function withTenantScope(tenantId: string) {
  return Prisma.defineExtension({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_SCOPED_MODELS.includes(model)) {
          return query(args);
        }

        const mutatedArgs = { ...args } as Record<string, unknown>;

        // Read operations: inject tenantId into where clause
        if (
          ['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'].includes(
            operation,
          )
        ) {
          mutatedArgs.where = { ...(mutatedArgs.where as object), tenantId };
        }

        // Create operations: inject tenantId into data
        if (['create', 'createMany', 'createManyAndReturn'].includes(operation)) {
          if (Array.isArray(mutatedArgs.data)) {
            mutatedArgs.data = (mutatedArgs.data as Record<string, unknown>[]).map((d) => ({
              ...d,
              tenantId,
            }));
          } else if (mutatedArgs.data) {
            mutatedArgs.data = { ...(mutatedArgs.data as object), tenantId };
          }
        }

        // Update/delete operations: inject tenantId into where clause
        if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
          mutatedArgs.where = { ...(mutatedArgs.where as object), tenantId };
        }

        return query(mutatedArgs);
      },
    },
  });
}
