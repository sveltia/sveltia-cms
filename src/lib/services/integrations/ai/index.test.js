import { describe, expect, it } from 'vitest';

import { allAiServices } from '.';

describe('allAiServices', () => {
  it('should list the AI services keyed by service ID', () => {
    expect(Object.keys(allAiServices)).toEqual([
      'anthropic',
      'deepseek',
      'google-ai',
      'mistral',
      'openai',
    ]);

    Object.entries(allAiServices).forEach(([key, service]) => {
      expect(service.serviceId).toBe(key);
      expect(typeof service.serviceLabel).toBe('string');
      expect(service.apiKeyPattern).toBeInstanceOf(RegExp);
      expect(typeof service.complete).toBe('function');
    });
  });
});
