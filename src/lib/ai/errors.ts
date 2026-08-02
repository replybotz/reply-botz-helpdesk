import { AppError } from '@/lib/errors';

export class AiNotConfiguredError extends AppError {
  constructor(message = 'No active AI configuration for this tenant') {
    super(message, 409, 'AI_NOT_CONFIGURED');
    this.name = 'AiNotConfiguredError';
  }
}

/**
 * The provider's safety layer declined the request. Anthropic surfaces this as
 * `stop_reason: "refusal"` on a 200; OpenAI-compatible providers use a
 * `content_filter` finish reason.
 */
export class AiRefusalError extends AppError {
  constructor(detail?: string | null) {
    super(`The model declined this request${detail ? ` (${detail})` : ''}`, 422, 'AI_REFUSED');
    this.name = 'AiRefusalError';
  }
}

export class AiEmptyOutputError extends AppError {
  constructor(message = 'The model returned no usable output') {
    super(message, 502, 'AI_NO_OUTPUT');
    this.name = 'AiEmptyOutputError';
  }
}
