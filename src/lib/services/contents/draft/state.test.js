// @vitest-environment jsdom

import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import {
  createEntryDraftMountContext,
  EntryDraftState,
  getEntryDraftByElement,
  getEntryDraftContext,
  setEntryDraftContext,
  setEntryDraftRoot,
} from './state.svelte.js';

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

  describe('createEntryDraftMountContext()', () => {
    it('should create a `mount()` context holding the state under the same key', () => {
      const state = new EntryDraftState();
      const context = createEntryDraftMountContext(state);

      expect(context).toBeInstanceOf(Map);
      expect(context.size).toBe(1);
      expect(context.get('entry-draft')).toBe(state);
    });
  });

  describe('setEntryDraftRoot() and getEntryDraftByElement()', () => {
    it('should find the state through the DOM from within a registered editor root', () => {
      const state = new EntryDraftState();
      const root = document.createElement('div');
      const child = document.createElement('span');

      root.appendChild(child);
      setEntryDraftRoot(root, state);

      expect(root.hasAttribute('data-entry-draft-root')).toBe(true);
      expect(getEntryDraftByElement(child)).toBe(state);
      expect(getEntryDraftByElement(root)).toBe(state);
    });

    it('should tell the editors apart when more than one is open', () => {
      const stateA = new EntryDraftState();
      const stateB = new EntryDraftState();
      const rootA = document.createElement('div');
      const rootB = document.createElement('div');
      const childA = document.createElement('span');
      const childB = document.createElement('span');

      rootA.appendChild(childA);
      rootB.appendChild(childB);
      setEntryDraftRoot(rootA, stateA);
      setEntryDraftRoot(rootB, stateB);

      expect(getEntryDraftByElement(childA)).toBe(stateA);
      expect(getEntryDraftByElement(childB)).toBe(stateB);
    });

    it('should return `undefined` outside a registered editor root', () => {
      expect(getEntryDraftByElement(document.createElement('div'))).toBeUndefined();
      expect(getEntryDraftByElement(null)).toBeUndefined();
      expect(getEntryDraftByElement(undefined)).toBeUndefined();
    });
  });
});
