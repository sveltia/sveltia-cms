import { get, writable } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';

import { getValueMapSnapshot } from './value-map.svelte.js';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

vi.mock('$lib/services/contents/draft', () => ({
  entryDraft: writable(undefined),
}));

/**
 * Create a minimal entry draft holding the given values.
 * @param {Record<string, any>} currentValues Current values keyed by locale.
 * @param {Record<string, any>} [extraValues] Extra values keyed by locale.
 * @returns {EntryDraft} Draft-like object.
 */
const createDraft = (currentValues, extraValues = {}) =>
  /** @type {EntryDraft} */ (/** @type {any} */ ({ currentValues, extraValues }));

describe('contents/draft/value-map', () => {
  beforeEach(() => {
    entryDraft.set(undefined);
  });

  it('should return an empty object when there is no draft', () => {
    expect(getValueMapSnapshot(undefined, 'en')).toEqual({});
    expect(getValueMapSnapshot(null, 'en')).toEqual({});
  });

  it('should return an empty object when the locale has no content', () => {
    const draft = createDraft({ en: { title: 'Hello' } });

    entryDraft.set(draft);

    expect(getValueMapSnapshot(draft, 'ja')).toEqual({});
  });

  it('should return the flattened content for the given locale', () => {
    const draft = createDraft({ en: { title: 'Hello' }, ja: { title: 'こんにちは' } });

    entryDraft.set(draft);

    expect(getValueMapSnapshot(draft, 'en')).toEqual({ title: 'Hello' });
    expect(getValueMapSnapshot(draft, 'ja')).toEqual({ title: 'こんにちは' });
  });

  it('should read from the given value store key', () => {
    const draft = createDraft({ en: { title: 'Hello' } }, { en: { extra: 'Extra' } });

    entryDraft.set(draft);

    expect(getValueMapSnapshot(draft, 'en', 'extraValues')).toEqual({ extra: 'Extra' });
  });

  it('should detach the snapshot from the draft', () => {
    const draft = createDraft({ en: { title: 'Hello' } });

    entryDraft.set(draft);

    const snapshot = getValueMapSnapshot(draft, 'en');

    draft.currentValues.en.title = 'Changed';

    expect(snapshot.title).toBe('Hello');
  });

  it('should reuse the same snapshot for repeated calls', () => {
    const draft = createDraft({ en: { title: 'Hello' } });

    entryDraft.set(draft);

    expect(getValueMapSnapshot(draft, 'en')).toBe(getValueMapSnapshot(draft, 'en'));
  });

  it('should not share snapshots between locales or value store keys', () => {
    const draft = createDraft({ en: { title: 'Hello' } }, { en: { title: 'Extra' } });

    entryDraft.set(draft);

    expect(getValueMapSnapshot(draft, 'en')).not.toBe(getValueMapSnapshot(draft, 'ja'));
    expect(getValueMapSnapshot(draft, 'en')).not.toBe(
      getValueMapSnapshot(draft, 'en', 'extraValues'),
    );
  });

  it('should return fresh values after the draft store is updated', () => {
    const draft = createDraft({ en: { title: 'Hello' } });

    entryDraft.set(draft);
    expect(getValueMapSnapshot(draft, 'en')).toEqual({ title: 'Hello' });

    // Mutating in place then writing to the store is how the editor updates a field
    draft.currentValues.en.title = 'Changed';
    entryDraft.set(draft);

    expect(getValueMapSnapshot(get(entryDraft), 'en')).toEqual({ title: 'Changed' });
  });
});
