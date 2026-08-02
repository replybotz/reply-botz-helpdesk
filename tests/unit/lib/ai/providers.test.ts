process.env.ENCRYPTION_KEY = 'a'.repeat(64);

jest.mock('@/lib/db', () => ({ prisma: { aiConfiguration: { findFirst: jest.fn() } } }));

import { createProvider, PROVIDERS, PROVIDER_IDS, isProviderId } from '@/lib/ai/providers';
import { AiNotConfiguredError } from '@/lib/ai/errors';

describe('provider registry', () => {
  it('covers the providers the product promises', () => {
    for (const id of ['anthropic', 'openai', 'openrouter', 'google', 'ollama']) {
      expect(PROVIDER_IDS).toContain(id);
    }
  });

  it('gives every provider a usable default model, except the custom escape hatch', () => {
    for (const definition of Object.values(PROVIDERS)) {
      if (definition.id === 'openai-compatible') continue;
      expect(definition.defaultModel).not.toBe('');
    }
  });

  it('every provider either pins a base URL or demands one', () => {
    for (const definition of Object.values(PROVIDERS)) {
      if (definition.kind === 'anthropic') continue;
      expect(Boolean(definition.baseUrl) || definition.requiresBaseUrl).toBe(true);
    }
  });

  it('recognises only known provider ids', () => {
    expect(isProviderId('anthropic')).toBe(true);
    expect(isProviderId('not-a-provider')).toBe(false);
  });
});

describe('createProvider', () => {
  it('builds an Anthropic provider and defaults the model', () => {
    const provider = createProvider({ providerId: 'anthropic', apiKey: 'sk-test' });
    expect(provider.providerId).toBe('anthropic');
    expect(provider.model).toBe(PROVIDERS.anthropic.defaultModel);
  });

  it('honours an explicit model override', () => {
    const provider = createProvider({
      providerId: 'openai',
      model: 'gpt-5-mini',
      apiKey: 'sk-test',
    });
    expect(provider.model).toBe('gpt-5-mini');
  });

  it('allows keyless providers such as Ollama', () => {
    const provider = createProvider({ providerId: 'ollama' });
    expect(provider.model).toBe(PROVIDERS.ollama.defaultModel);
  });

  it('rejects a provider that needs an API key when none is given', () => {
    expect(() => createProvider({ providerId: 'openai' })).toThrow(AiNotConfiguredError);
  });

  it('rejects a custom endpoint with no base URL', () => {
    expect(() =>
      createProvider({ providerId: 'openai-compatible', model: 'local-model' }),
    ).toThrow(AiNotConfiguredError);
  });

  it('accepts a custom endpoint once a base URL is supplied', () => {
    const provider = createProvider({
      providerId: 'openai-compatible',
      model: 'local-model',
      settings: { baseUrl: 'http://127.0.0.1:8000/v1' },
    });
    expect(provider.model).toBe('local-model');
  });

  it('requires a model name for the custom provider', () => {
    expect(() =>
      createProvider({
        providerId: 'openai-compatible',
        settings: { baseUrl: 'http://127.0.0.1:8000/v1' },
      }),
    ).toThrow(AiNotConfiguredError);
  });
});
