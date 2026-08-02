import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AiEmptyOutputError, AiRefusalError } from '../errors';
import type {
  AiProvider,
  GenerateObjectParams,
  GenerateTextParams,
  ProviderId,
} from './types';

const DEFAULT_MAX_TOKENS = 16000;

/**
 * Safety classifiers can decline a request: the call returns HTTP 200 with
 * `stop_reason: "refusal"` and possibly empty content, so this is checked
 * before reading any content block.
 */
function assertNotRefused(response: Anthropic.Message): void {
  if (response.stop_reason === 'refusal') {
    throw new AiRefusalError(response.stop_details?.category);
  }
}

function textFrom(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export class AnthropicProvider implements AiProvider {
  readonly providerId: ProviderId = 'anthropic';

  private readonly client: Anthropic;

  constructor(
    readonly model: string,
    apiKey: string,
    baseURL?: string,
  ) {
    this.client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: params.system,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: params.messages,
    });

    assertNotRefused(response);

    const text = textFrom(response.content);
    if (!text) throw new AiEmptyOutputError();
    return text;
  }

  async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: params.system,
      thinking: { type: 'adaptive' },
      // Classification is routine work — low effort keeps latency and spend
      // down without hurting quality on this task.
      output_config: {
        effort: 'low',
        format: zodOutputFormat(params.schema),
      },
      messages: params.messages,
    });

    assertNotRefused(response);

    if (!response.parsed_output) {
      throw new AiEmptyOutputError('The model returned no structured output');
    }
    return response.parsed_output;
  }
}
