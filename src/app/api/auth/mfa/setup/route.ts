import { headers } from 'next/headers';
import { generateMfaSecret } from '@/lib/auth/mfa';
import { errorResponse, AuthenticationError } from '@/lib/errors';

export async function POST() {
  try {
    const headerStore = await headers();
    const userId = headerStore.get('x-user-id');
    const email = headerStore.get('x-user-email');

    if (!userId) {
      throw new AuthenticationError();
    }

    const { secret, uri } = generateMfaSecret(email ?? 'user');

    return Response.json({ secret, uri });
  } catch (error) {
    return errorResponse(error);
  }
}
