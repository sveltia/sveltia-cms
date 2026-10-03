// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';

import { getValueMapVersion } from '$lib/services/contents/draft/create/proxy.svelte';
import { updateComputedValues } from '$lib/services/contents/draft/update/compute';
import { trackComputedValues } from '$lib/services/contents/draft/update/compute-tracking.svelte';
import { createDeepState, createRootEffect } from '$lib/services/utils/state.svelte';

vi.mock('$lib/services/contents/draft/create/proxy.svelte', () => ({
  // Stand in for the version counter of a value map proxy
  getValueMapVersion: vi.fn((valueMap) => valueMap.version),
}));
vi.mock('$lib/services/contents/draft/update/compute');

/**
 * Wait for the pending effects to run.
 * @returns {Promise<void>} Promise.
 */
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

describe('contents/draft/update/compute-tracking', () => {
  test('resolves the Compute fields whenever a value they can depend on changes', async () => {
    const box = createDeepState({
      currentValues: { en: { version: 0 }, ja: { version: 0 } },
      extraValues: { en: { 'body:component:0': '' } },
      currentLocales: { en: true, ja: true },
      unrelated: 0,
    });

    const draft = /** @type {any} */ (box.current);
    const cleanup = createRootEffect(() => trackComputedValues(draft));

    await settle();
    expect(updateComputedValues).toHaveBeenCalledTimes(1);
    expect(updateComputedValues).toHaveBeenCalledWith(draft);
    expect(getValueMapVersion).toHaveBeenCalledTimes(2);

    draft.currentValues.ja.version = 1;
    await settle();
    expect(updateComputedValues).toHaveBeenCalledTimes(2);

    draft.extraValues.en['body:component:0'] = 'Hello';
    await settle();
    expect(updateComputedValues).toHaveBeenCalledTimes(3);

    draft.currentLocales.ja = false;
    await settle();
    expect(updateComputedValues).toHaveBeenCalledTimes(4);

    draft.unrelated = 1;
    await settle();
    expect(updateComputedValues).toHaveBeenCalledTimes(4);

    cleanup();
  });

  test('doesn’t depend on what the Compute fields read while being resolved', async () => {
    const box = createDeepState({
      currentValues: {},
      extraValues: {},
      currentLocales: {},
      other: 0,
    });

    const draft = /** @type {any} */ (box.current);

    vi.mocked(updateComputedValues).mockImplementation((d) => {
      void (/** @type {any} */ (d).other);

      return false;
    });

    const cleanup = createRootEffect(() => trackComputedValues(draft));

    await settle();
    expect(updateComputedValues).toHaveBeenCalledTimes(1);

    draft.other = 1;
    await settle();
    expect(updateComputedValues).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
