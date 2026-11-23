// @vitest-environment happy-dom

import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { isDraftModified } from '$lib/services/contents/draft';
import { createState } from '$lib/services/utils/state.svelte';

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
  // Compare the titles only
  isDraftModified: vi.fn(
    (draft) => !!draft && draft.originalValues.en.title !== draft.currentValues.en.title,
  ),
}));

// A plain value map has no version, so its snapshot is taken afresh rather than shared
vi.mock('$lib/services/contents/draft/create/versioned-map.svelte', () => ({
  getValueMapVersion: vi.fn(() => undefined),
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

    it('should compare the value map snapshots rather than the value map proxies', () => {
      const state = new EntryDraftState();
      const draft = createDraft('Changed');
      const valueMap = draft.currentValues.en;

      state.current = draft;
      flushSync();
      expect(state.modified).toBe(true);

      const [comparedDraft] = /** @type {any[]} */ (vi.mocked(isDraftModified).mock.lastCall);

      expect(comparedDraft.currentValues.en).not.toBe(valueMap);
      expect(comparedDraft.currentValues.en).toEqual({ title: 'Changed' });
    });

    it('should compare a snapshot of the original values, taken again once they are replaced', () => {
      const state = new EntryDraftState();
      const draft = createState(createDraft('Changed'));
      const originalValueMap = draft.originalValues.en;

      state.current = draft;
      flushSync();
      expect(state.modified).toBe(true);

      const [firstDraft] = /** @type {any[]} */ (vi.mocked(isDraftModified).mock.lastCall);

      expect(firstDraft.originalValues.en).not.toBe(originalValueMap);
      expect(firstDraft.originalValues.en).toEqual({ title: 'Original' });

      // A change to the current values reuses the snapshot
      draft.currentValues.en.title = 'Changed again';
      flushSync();
      expect(state.modified).toBe(true);

      const [secondDraft] = /** @type {any[]} */ (vi.mocked(isDraftModified).mock.lastCall);

      expect(secondDraft.originalValues.en).toBe(firstDraft.originalValues.en);

      // The original values are replaced as a whole once the draft is saved
      draft.originalValues.en = { title: 'Changed again' };
      flushSync();
      expect(state.modified).toBe(false);
    });

    it('should pass on a locale without original values as it is', () => {
      const state = new EntryDraftState();
      const draft = createDraft('Changed');

      // e.g. a locale enabled for an existing entry that has no file for it yet
      /** @type {any} */ (draft.originalValues).fr = undefined;
      state.current = draft;
      flushSync();
      expect(state.modified).toBe(true);

      const [comparedDraft] = /** @type {any[]} */ (vi.mocked(isDraftModified).mock.lastCall);

      expect(comparedDraft.originalValues).toEqual({ en: { title: 'Original' }, fr: undefined });
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
