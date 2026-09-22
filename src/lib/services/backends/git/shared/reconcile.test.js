import { describe, expect, test } from 'vitest';

import { reconcileAssets, reconcileEntries } from './reconcile';

/**
 * Make a minimal entry with the given ID and locale paths.
 * @param {string} id Entry ID.
 * @param {Record<string, string>} paths Locale code → path.
 * @returns {any} Entry.
 */
const makeEntry = (id, paths) => ({
  id,
  locales: Object.fromEntries(
    Object.entries(paths).map(([locale, path]) => [locale, { slug: id, path, content: {} }]),
  ),
});

describe('reconcileEntries', () => {
  test('returns the new list as is on a first load', () => {
    const entries = [makeEntry('a', { _default: 'a.md' })];

    expect(reconcileEntries({ entries, previous: [], changedPaths: new Set(['a.md']) })).toBe(
      entries,
    );
  });

  test('keeps the previous object when none of the files have changed', () => {
    const previous = makeEntry('old', { en: 'en/a.md', fr: 'fr/a.md' });
    const next = makeEntry('new', { en: 'en/a.md', fr: 'fr/a.md' });

    const [result] = reconcileEntries({
      entries: [next],
      previous: [previous],
      changedPaths: new Set(),
    });

    expect(result).toBe(previous);
  });

  test('carries the previous ID over to a changed entry', () => {
    const previous = makeEntry('old', { en: 'en/a.md', fr: 'fr/a.md' });
    const next = makeEntry('new', { en: 'en/a.md', fr: 'fr/a.md' });

    const [result] = reconcileEntries({
      entries: [next],
      previous: [previous],
      changedPaths: new Set(['fr/a.md']),
    });

    expect(result).not.toBe(previous);
    expect(result).toEqual({ ...next, id: 'old' });
  });

  test('treats a locale file added or removed as a change', () => {
    const previous = makeEntry('old', { en: 'en/a.md' });
    const added = makeEntry('new', { en: 'en/a.md', fr: 'fr/a.md' });

    expect(
      reconcileEntries({ entries: [added], previous: [previous], changedPaths: new Set() })[0],
    ).toEqual({ ...added, id: 'old' });

    const removed = makeEntry('new', { en: 'en/a.md' });

    expect(
      reconcileEntries({
        entries: [removed],
        previous: [makeEntry('old', { en: 'en/a.md', fr: 'fr/a.md' })],
        changedPaths: new Set(),
      })[0],
    ).toEqual({ ...removed, id: 'old' });
  });

  test('matches through any of the locale files', () => {
    // The default locale file is gone, but the French one still links the two
    const previous = makeEntry('old', { en: 'en/a.md', fr: 'fr/a.md' });
    const next = makeEntry('new', { fr: 'fr/a.md' });

    expect(
      reconcileEntries({ entries: [next], previous: [previous], changedPaths: new Set() })[0],
    ).toEqual({ ...next, id: 'old' });
  });

  test('gives a previous ID to one entry only', () => {
    // The French file has been given a canonical slug of its own, splitting the entry in two
    const previous = makeEntry('old', { en: 'en/a.md', fr: 'fr/a.md' });
    const first = makeEntry('new-1', { en: 'en/a.md' });
    const second = makeEntry('new-2', { fr: 'fr/a.md' });

    const result = reconcileEntries({
      entries: [first, second],
      previous: [previous],
      changedPaths: new Set(['fr/a.md']),
    });

    expect(result[0]).toEqual({ ...first, id: 'old' });
    expect(result[1]).toBe(second);
  });

  test('leaves an entry with no counterpart alone', () => {
    const previous = makeEntry('old', { _default: 'a.md' });
    const next = makeEntry('new', { _default: 'b.md' });

    expect(
      reconcileEntries({
        entries: [next],
        previous: [previous],
        changedPaths: new Set(['b.md']),
      })[0],
    ).toBe(next);
  });
});

describe('reconcileAssets', () => {
  const previous = /** @type {any} */ ({ path: 'img/a.png', sha: '1', blobURL: 'blob:1' });
  const next = /** @type {any} */ ({ path: 'img/a.png', sha: '1' });

  test('returns the new list as is on a first load', () => {
    const assets = [next];

    expect(reconcileAssets({ assets, previous: [], changedPaths: new Set() })).toBe(assets);
  });

  test('keeps the previous object when the file is unchanged', () => {
    expect(
      reconcileAssets({ assets: [next], previous: [previous], changedPaths: new Set() })[0],
    ).toBe(previous);
  });

  test('takes the new object when the file has changed or is new', () => {
    expect(
      reconcileAssets({
        assets: [next],
        previous: [previous],
        changedPaths: new Set(['img/a.png']),
      })[0],
    ).toBe(next);

    const added = /** @type {any} */ ({ path: 'img/b.png', sha: '2' });

    expect(
      reconcileAssets({ assets: [added], previous: [previous], changedPaths: new Set() })[0],
    ).toBe(added);
  });
});
