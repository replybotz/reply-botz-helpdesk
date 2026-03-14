import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ILmsProvider, LmsCapability, LmsSyncResult } from '../interfaces/lms-provider.interface';

/**
 * Base class with shared utilities for all LMS providers.
 */
export abstract class BaseLmsProvider implements ILmsProvider {
  abstract readonly name: string;
  abstract readonly platform: string;
  abstract readonly capabilities: LmsCapability[];
  abstract readonly authMethod: 'oauth2' | 'api_key' | 'lti';

  protected abstract readonly logger: Logger;

  abstract syncUsers(integrationId: string, courseId?: string): Promise<LmsSyncResult>;
  abstract syncCourses(integrationId: string): Promise<LmsSyncResult>;
  abstract syncAssignments(integrationId: string, courseId: string): Promise<LmsSyncResult>;
  abstract getAssignmentContext(
    integrationId: string,
    assignmentId: string,
    userId?: string,
  ): ReturnType<ILmsProvider['getAssignmentContext']>;
  abstract resolveUserFromEmail(
    integrationId: string,
    email: string,
  ): ReturnType<ILmsProvider['resolveUserFromEmail']>;
  abstract testConnection(
    integrationId: string,
  ): Promise<{ success: boolean; message: string }>;

  validateWebhookSignature(payload: Buffer, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    const sigBuffer = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  async processWebhookEvent(event: Record<string, unknown>): Promise<void> {
    this.logger.log(`Processing webhook event: ${JSON.stringify(event)}`);
  }

  protected createSyncResult(
    syncType: string,
    recordsSynced: number,
    errors: string[],
    startedAt: Date,
  ): LmsSyncResult {
    return {
      syncType,
      recordsSynced,
      errors,
      startedAt,
      completedAt: new Date(),
    };
  }

  protected notImplemented(method: string): never {
    const message = `${this.name}.${method} is not yet implemented`;
    this.logger.warn(message);
    throw new Error(message);
  }
}
