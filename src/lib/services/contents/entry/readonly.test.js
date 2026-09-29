// @ts-nocheck
import { afterEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';

import { getReadonlyEntryLabel, isEntryReadonly } from './readonly';

vi.mock('$lib/services/contents/collection', () => ({
  getCollectionLabel: vi.fn((collection) => collection.label),
}));
vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn((_collection, entry) => entry.slug),
}));
vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/entry', () => ({
  getAssociatedCollections: vi.fn(() => []),
}));

const entry = { id: 'a', slug: 'a', locales: {} };

describe('Test isEntryReadonly()', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
  });

  test('returns false for an entry in editable collections', () => {
    cmsConfig.current = {};
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts' }]);

    expect(isEntryReadonly(entry)).toBe(false);
  });

  test('returns true when the whole CMS is read-only', () => {
    cmsConfig.current = { readonly: true };
    vi.mocked(getAssociatedCollections).mockReturnValue([]);

    expect(isEntryReadonly(entry)).toBe(true);
  });

  test('returns true when any collection the entry belongs to is read-only', () => {
    cmsConfig.current = {};
    vi.mocked(getAssociatedCollections).mockReturnValue([
      { name: 'posts' },
      { name: 'archive', readonly: true },
    ]);

    expect(isEntryReadonly(entry)).toBe(true);
  });

  test('returns true when the collection file is read-only', () => {
    cmsConfig.current = {};
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'settings', _fileMap: {} }]);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([{ name: 'site', readonly: true }]);

    expect(isEntryReadonly(entry)).toBe(true);
  });
});

describe('Test getReadonlyEntryLabel()', () => {
  test('names the entry with the given collection', () => {
    expect(getReadonlyEntryLabel(entry, { name: 'news', label: 'News' })).toBe('News › a');
  });

  test('falls back to the first collection the entry belongs to', () => {
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts', label: 'Posts' }]);

    expect(getReadonlyEntryLabel(entry)).toBe('Posts › a');
  });

  test('falls back to the slug without a collection', () => {
    vi.mocked(getAssociatedCollections).mockReturnValue([]);

    expect(getReadonlyEntryLabel(entry)).toBe('a');
  });
});
