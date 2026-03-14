import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS } from '../../shared/events/events.module';

export interface ModerationRequest {
  content: string;
  messageId?: string;
  conversationId?: string;
  organizationId: string;
  ageGroup?: string;
  senderType?: string;
}

export interface ModerationResult {
  flagged: boolean;
  action: 'approve' | 'flag' | 'block';
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
  reason?: string;
}

// Categories that are always blocked regardless of age group
const ALWAYS_BLOCK_CATEGORIES = ['sexual/minors', 'self-harm/intent', 'self-harm/instructions'];

// Age-group specific thresholds for flagging
const AGE_GROUP_THRESHOLDS: Record<string, Record<string, number>> = {
  'k-8': {
    sexual: 0.01,
    violence: 0.05,
    harassment: 0.05,
    hate: 0.01,
    'self-harm': 0.01,
  },
  '9-12': {
    sexual: 0.05,
    violence: 0.1,
    harassment: 0.1,
    hate: 0.05,
    'self-harm': 0.05,
  },
  college: {
    sexual: 0.2,
    violence: 0.3,
    harassment: 0.2,
    hate: 0.1,
    'self-harm': 0.1,
  },
  adult: {
    sexual: 0.5,
    violence: 0.5,
    harassment: 0.4,
    hate: 0.3,
    'self-harm': 0.2,
  },
};

@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async moderate(request: ModerationRequest): Promise<ModerationResult> {
    let aiResult;
    try {
      aiResult = await this.aiGateway.moderate({ input: request.content });
    } catch (err) {
      this.logger.error('Content moderation API failed', err);
      // Fail open — log but don't block
      return {
        flagged: false,
        action: 'approve',
        categories: {},
        categoryScores: {},
        reason: 'Moderation service unavailable',
      };
    }

    const ageGroup = request.ageGroup ?? 'adult';
    const thresholds = AGE_GROUP_THRESHOLDS[ageGroup] ?? AGE_GROUP_THRESHOLDS.adult;

    // Always block certain categories
    const alwaysBlockTriggered = ALWAYS_BLOCK_CATEGORIES.some(
      (cat) => aiResult.categories[cat] === true,
    );

    // Check age-group thresholds
    const thresholdExceeded = Object.entries(thresholds).some(
      ([category, threshold]) =>
        (aiResult.categoryScores[category] ?? 0) >= threshold,
    );

    let action: 'approve' | 'flag' | 'block';
    if (alwaysBlockTriggered) {
      action = 'block';
    } else if (aiResult.flagged || thresholdExceeded) {
      action = 'flag';
    } else {
      action = 'approve';
    }

    const result: ModerationResult = {
      flagged: aiResult.flagged || thresholdExceeded,
      action,
      categories: aiResult.categories,
      categoryScores: aiResult.categoryScores,
      reason: action !== 'approve' ? this.buildReason(aiResult.categories) : undefined,
    };

    // Log to database
    if (request.messageId || request.conversationId) {
      await this.logModerationResult(request, result);
    }

    // Emit event for escalation handlers
    if (action === 'flag' || action === 'block') {
      this.eventEmitter.emit(EVENTS.CONTENT_FLAGGED, {
        ...request,
        result,
      });
    }

    return result;
  }

  private async logModerationResult(
    request: ModerationRequest,
    result: ModerationResult,
  ): Promise<void> {
    try {
      await this.prisma.contentModerationLog.create({
        data: {
          messageId: request.messageId,
          conversationId: request.conversationId,
          moderationResult: {
            flagged: result.flagged,
            categories: result.categories,
            categoryScores: result.categoryScores,
          },
          actionTaken: result.action,
        },
      });
    } catch (err) {
      this.logger.error('Failed to log moderation result', err);
    }
  }

  private buildReason(categories: Record<string, boolean>): string {
    const flagged = Object.entries(categories)
      .filter(([, v]) => v)
      .map(([k]) => k);
    return `Content flagged: ${flagged.join(', ')}`;
  }

  async getPolicyForOrganization(organizationId: string, ageGroup?: string) {
    return this.prisma.contentModerationPolicy.findFirst({
      where: {
        organizationId,
        ...(ageGroup ? { ageGroup } : {}),
      },
    });
  }
}
