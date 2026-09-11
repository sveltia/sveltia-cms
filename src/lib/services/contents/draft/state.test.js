import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { EntryDraftState, getEntryDraftContext, setEntryDraftContext } from './state.svelte.js';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

const { getContext, setContext } = vi.hoisted(() => ({
  getContext: vi.fn(),
  setContext: vi.fn((key, value) => value),
}));

vi.mock('svelte', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getContext,
  setContext,
}));

vi.mock('$lib/services/contents/draft', () => ({
  /**
   * Compare the titles only.
   * @param {any} draft Draft.
   * @returns {boolean} Whether the title has been modified.
   */
  isDraftModified: (draft) =>
    !!draft && draft.originalValues.en.title !== draft.currentValues.en.title,
}));

/**
 * Build a minimal draft.
 * @param {string} title Current title.
 * @returns {EntryDraft} Draft.
 */
const createDraft = (title) =>
  /** @type {EntryDraft} */ (
    /** @type {any} */ ({
      originalValues: { en: { title: 'Original' } },
      currentValues: { en: { title } },
    })
  );

describe('contents/draft/state', () => {
  describe('EntryDraftState', () => {
    it('should hold no draft initially', () => {
      const state = new EntryDraftState();

      expect(state.current).toBeUndefined();
      expect(state.modified).toBe(false);
    });

    it('should tell whether the current draft has been modified', () => {
      const state = new EntryDraftState();

      state.current = createDraft('Original');
      flushSync();
      expect(state.modified).toBe(false);

      state.current = createDraft('Changed');
      flushSync();
      expect(state.modified).toBe(true);

      state.current = null;
      flushSync();
      expect(state.modified).toBe(false);
    });
  });

  describe('setEntryDraftContext() and getEntryDraftContext()', () => {
    it('should share the state through the Svelte context', () => {
      const state = new EntryDraftState();

      expect(setEntryDraftContext(state)).toBe(state);
      expect(setContext).toHaveBeenCalledWith('entry-draft', state);

      getContext.mockReturnValue(state);
      expect(getEntryDraftContext()).toBe(state);
      expect(getContext).toHaveBeenCalledWith('entry-draft');
    });
  });
});
