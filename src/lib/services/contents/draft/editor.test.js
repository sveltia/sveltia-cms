// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';

import { initEntryDraftEditor } from '$lib/services/contents/draft/editor.svelte';
import { setEntryDraftRoot } from '$lib/services/contents/draft/state.svelte';
import { trackComputedValues } from '$lib/services/contents/draft/update/compute-tracking.svelte';
import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

vi.mock('$lib/services/contents/draft/state.svelte', () => ({
  setEntryDraftRoot: vi.fn(),
}));
vi.mock('$lib/services/contents/draft/update/compute-tracking.svelte', () => ({
  trackComputedValues: vi.fn(),
}));

/**
 * Wait for the pending effects to run.
 * @returns {Promise<void>} Promise.
 */
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

describe('contents/draft/editor', () => {
  test('registers the root element once it’s bound', async () => {
    const root = createRawState(/** @type {HTMLElement | undefined} */ (undefined));
    const entryDraft = /** @type {any} */ ({ current: undefined });

    const cleanup = createRootEffect(() =>
      initEntryDraftEditor(
        () => entryDraft,
        () => root.current,
      ),
    );

    await settle();
    expect(setEntryDraftRoot).not.toHaveBeenCalled();

    const element = document.createElement('div');

    root.current = element;
    await settle();
    expect(setEntryDraftRoot).toHaveBeenCalledExactlyOnceWith(element, entryDraft);

    cleanup();
  });

  test('tracks the Compute fields of the draft open in the editor', async () => {
    const entryDraft = createRawState(/** @type {any} */ (undefined));

    const cleanup = createRootEffect(() =>
      initEntryDraftEditor(
        () => /** @type {any} */ (entryDraft),
        () => undefined,
      ),
    );

    await settle();
    expect(trackComputedValues).not.toHaveBeenCalled();

    const draft = { currentValues: {} };

    entryDraft.current = draft;
    await settle();
    expect(trackComputedValues).toHaveBeenCalledExactlyOnceWith(draft);

    cleanup();
  });
});
