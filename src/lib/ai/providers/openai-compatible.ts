import OpenAI from 'openai';
import { z } from 'zod';
import { AiEmptyOutputError, AiRefusalError } from '../errors';
import type {
  AiProvider,
  GenerateObjectParams,
  GenerateTextParams,
  ProviderId,
} from './types';

const DEFAULT_MAX_TOKENS = 4096;

/**
 * Adapter for every vendor exposing an OpenAI-shaped `/chat/completions`
 * endpoint — OpenAI, OpenRouter, Gemini (via Google's compatibility layer),
 * Ollama, Groq, Mistral, DeepSeek, Together, xAI, Azure, and self-hosted
 * runtimes like vLLM or LM Studio.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  private readonly client: OpenAI;

  constructor(
    readonly providerId: ProviderId,
    readonly model: string,
    options: { apiKey?: string; baseURL?: string; supportsJsonSchema: boolean },
  ) {
    this.client = new OpenAI({
      // Local runtimes such as Ollama ignore the key but the SDK requires one.
      apiKey: options.apiKey || 'not-required',
      baseURL: options.baseURL,
    });
    this.supportsJsonSchema = options.supportsJsonSchema;
  }

  private readonly supportsJsonSchema: boolean;

  async generateText(params: GenerateTextParams): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: 'system', content: params.system },
        ...params.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    });

    const choice = completion.choices[0];
    if (choice?.finish_reason === 'content_filter') {
      throw new AiRefusalError('content_filter');
    }

    const text = choice?.message?.content?.trim();
    if (!text) throw new AiEmptyOutputError();
    return text;
  }

  async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
    const jsonSchema = z.toJSONSchema(params.schema, { target: 'draft-7' });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        {
          role: 'system',
          content: this.supportsJsonSchema
            ? params.system
            : // Without native enforcement the shape has to be stated in the
              // prompt; the response is still validated below either way.
              `${params.system}\n\nRespond with JSON only, matching this schema:\n${JSON.stringify(jsonSchema)}`,
        },
        ...params.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      response_format: this.supportsJsonSchema
        ? {
            type: 'json_schema',
            json_schema: { name: params.schemaName, schema: jsonSchema, strict: true },
          }
        : { type: 'json_object' },
    });

    const choice = completion.choices[0];
    if (choice?.finish_reason === 'content_filter') {
      throw new AiRefusalError('content_filter');
    }

    const raw = choice?.message?.content?.trim();
    if (!raw) throw new AiEmptyOutputError('The model returned no structured output');

    return params.schema.parse(parseJsonLoose(raw));
  }
}

/**
 * Models without native schema enforcement often wrap JSON in prose or a
 * fenced code block; recover the object rather than failing the job.
 */
function parseJsonLoose(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced?.[1] ?? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    return JSON.parse(candidate);
  }
}
