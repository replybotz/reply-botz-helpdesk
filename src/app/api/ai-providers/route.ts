import { withPermission } from '@/lib/rbac/guard';
import { Permission } from '@/lib/rbac/permissions';
import { PROVIDERS } from '@/lib/ai/providers';
import { errorResponse } from '@/lib/errors';

/** Provider catalog for the settings UI — metadata only, no secrets. */
export const GET = withPermission(Permission.AI_CONFIG_READ, async () => {
  try {
    return Response.json({ providers: Object.values(PROVIDERS) });
  } catch (error) {
    return errorResponse(error);
  }
});
