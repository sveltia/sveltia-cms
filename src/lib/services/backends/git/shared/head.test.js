import { describe, expect, test } from 'vitest';

import { createStaleCheck, dataGeneration } from '$lib/services/backends/git/shared/head';

describe('createStaleCheck()', () => {
  test('reports whether the data generation has changed since the check was created', () => {
    const isStale = createStaleCheck();

    expect(isStale()).toBe(false);

    dataGeneration.current += 1;

    expect(isStale()).toBe(true);
    // A check created in the new generation isn’t stale
    expect(createStaleCheck()()).toBe(false);
  });
});
