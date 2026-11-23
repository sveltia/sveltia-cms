import { describe, expect, it, vi } from 'vitest';

import {
  getFieldValueMapSnapshot,
  getValueMapSnapshot,
  getValueMapSnapshots,
} from './value-map.svelte.js';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * Versions of the fake value map proxies, keyed by value map. A real draft value map is a proxy
 * counting its writes; here the version is bumped by hand.
 */
const { versions } = vi.hoisted(() => ({ versions: new WeakMap() }));

vi.mock('$lib/services/contents/draft/create/versioned-map.svelte', () => ({
  /**
   * Get the fake version of the given value map.
   * @param {object} valueMap Value map.
   * @returns {number | undefined} Version.
   */
  getValueMapVersion: (valueMap) => versions.get(valueMap),
  /**
   * Get the fake version of a subtree, which is that of the whole map here.
   * @param {object} valueMap Value map.
   * @returns {number | undefined} Version.
   */
  getSubtreeVersion: (valueMap) => versions.get(valueMap),
}));

/**
 * Create a minimal entry draft holding the given values, with every value map versioned.
 * @param {Record<string, any>} currentValues Current values keyed by locale.
 * @param {Record<string, any>} [extraValues] Extra values keyed by locale.
 * @returns {EntryDraft} Draft-like object.
 */
const createDraft = (currentValues, extraValues = {}) => {
  [...Object.values(currentValues), ...Object.values(extraValues)].forEach((valueMap) => {
    versions.set(valueMap, 0);
  });

  return /** @type {EntryDraft} */ (/** @type {any} */ ({ currentValues, extraValues }));
};

/**
 * Simulate a write through a draft value map proxy, which bumps its version.
 * @param {Record<string, any>} valueMap Value map.
 * @param {string} key Key path.
 * @param {any} value New value.
 */
const write = (valueMap, key, value) => {
  valueMap[key] = value;
  versions.set(valueMap, versions.get(valueMap) + 1);
};

describe('contents/draft/value-map', () => {
  it('should snapshot every locale, keeping the snapshot of a locale that hasn’t changed', () => {
    const en = { title: 'Hello' };
    const ja = { title: 'こんにちは' };
    const draft = createDraft({ en, ja });
    const before = getValueMapSnapshots(draft);

    expect(before).toEqual({ en, ja });
    expect(before.en).not.toBe(en);

    write(en, 'title', 'Hi');

    const after = getValueMapSnapshots(draft);

    expect(after.en).toEqual({ title: 'Hi' });
    expect(after.ja).toBe(before.ja);
  });

  it('should snapshot nothing for a draft without values', () => {
    expect(getValueMapSnapshots(/** @type {any} */ ({}))).toEqual({});
  });

  it('should return an empty object when there is no draft', () => {
    expect(getValueMapSnapshot(undefined, 'en')).toEqual({});
    expect(getValueMapSnapshot(null, 'en')).toEqual({});
  });

  it('should return an empty object when the locale has no content', () => {
    const draft = createDraft({ en: { title: 'Hello' } });

    expect(getValueMapSnapshot(draft, 'ja')).toEqual({});
  });

  it('should return the flattened content for the given locale', () => {
    const draft = createDraft({ en: { title: 'Hello' }, ja: { title: 'こんにちは' } });

    expect(getValueMapSnapshot(draft, 'en')).toEqual({ title: 'Hello' });
    expect(getValueMapSnapshot(draft, 'ja')).toEqual({ title: 'こんにちは' });
  });

  it('should read from the given value store key', () => {
    const draft = createDraft({ en: { title: 'Hello' } }, { en: { extra: 'Extra' } });

    expect(getValueMapSnapshot(draft, 'en', 'extraValues')).toEqual({ extra: 'Extra' });
  });

  it('should detach the snapshot from the draft', () => {
    const draft = createDraft({ en: { title: 'Hello' } });
    const snapshot = getValueMapSnapshot(draft, 'en');

    write(draft.currentValues.en, 'title', 'Changed');

    expect(snapshot.title).toBe('Hello');
  });

  it('should reuse the same snapshot for repeated calls', () => {
    const draft = createDraft({ en: { title: 'Hello' } });

    expect(getValueMapSnapshot(draft, 'en')).toBe(getValueMapSnapshot(draft, 'en'));
  });

  it('should not share snapshots between locales or value store keys', () => {
    const draft = createDraft({ en: { title: 'Hello' } }, { en: { title: 'Extra' } });

    expect(getValueMapSnapshot(draft, 'en')).not.toBe(getValueMapSnapshot(draft, 'ja'));
    expect(getValueMapSnapshot(draft, 'en')).not.toBe(
      getValueMapSnapshot(draft, 'en', 'extraValues'),
    );
  });

  it('should return fresh values once the value map is written to', () => {
    const draft = createDraft({ en: { title: 'Hello' } });

    expect(getValueMapSnapshot(draft, 'en')).toEqual({ title: 'Hello' });

    write(draft.currentValues.en, 'title', 'Changed');

    expect(getValueMapSnapshot(draft, 'en')).toEqual({ title: 'Changed' });
  });

  it('should not memoize a plain value map, which has no version', () => {
    const currentValues = { en: { title: 'Hello' } };
    const draft = /** @type {EntryDraft} */ (/** @type {any} */ ({ currentValues }));

    expect(getValueMapSnapshot(draft, 'en')).toEqual({ title: 'Hello' });
    expect(getValueMapSnapshot(draft, 'en')).not.toBe(getValueMapSnapshot(draft, 'en'));

    currentValues.en.title = 'Changed';

    expect(getValueMapSnapshot(draft, 'en')).toEqual({ title: 'Changed' });
  });
});

describe('getFieldValueMapSnapshot()', () => {
  it('should give the same snapshot as the whole value map', () => {
    const en = { title: 'Hello', body: 'World' };
    const draft = createDraft({ en });

    expect(getFieldValueMapSnapshot(draft, 'en', 'title')).toBe(getValueMapSnapshot(draft, 'en'));
  });

  it('should take a snapshot of a value map without versions', () => {
    const draft = /** @type {any} */ ({ currentValues: { en: { title: 'Hello' } } });

    expect(getFieldValueMapSnapshot(draft, 'en', 'title')).toEqual({ title: 'Hello' });
  });
});
