import { describe, expect, test } from 'vitest';

import { createGeneration } from '$lib/services/utils/generation';

describe('createGeneration', () => {
  test('tells whether a captured generation is still current', () => {
    const generation = createGeneration();
    const isCurrent = generation.capture();

    expect(isCurrent()).toBe(true);
    generation.bump();
    expect(isCurrent()).toBe(false);
    expect(generation.capture()()).toBe(true);
    // Each counter is its own
    expect(createGeneration().capture()()).toBe(true);
  });
});
