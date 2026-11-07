import { describe, expect, test, vi } from 'vitest';

import {
  getBulkEditRowContext,
  getBulkEditRowSlug,
  getBulkEditRowValues,
  setBulkEditRowContext,
} from '$lib/services/contents/editor/bulk-edit-row';

/**
 * @import { Entry } from '$lib/types/private';
 */

const { getContext, setContext } = vi.hoisted(() => ({ getContext: vi.fn(), setContext: vi.fn() }));

vi.mock('svelte', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getContext,
  setContext,
}));

const entry = /** @type {Entry} */ (
  /** @type {unknown} */ ({
    id: 'posts/a',
    slug: 'a',
    sha: '',
    locales: {
      en: {
        slug: 'a',
        path: 'content/posts/a.md',
        content: { title: 'A', category: 'news', 'tags.0': 'x', 'tags.1': 'y', tagsets: 'z' },
      },
      ja: { slug: 'a-ja', path: 'content/posts/a.ja.md', content: { title: 'エー' } },
    },
  })
);

describe('getBulkEditRowContext() / setBulkEditRowContext()', () => {
  test('gets and sets the context', () => {
    const context = { values: {}, slug: 'a' };

    setBulkEditRowContext(context);
    expect(setContext).toHaveBeenCalledWith('bulk-edit-row', context);

    getContext.mockReturnValue(context);
    expect(getBulkEditRowContext()).toBe(context);
    expect(getContext).toHaveBeenCalledWith('bulk-edit-row');
  });
});

describe('getBulkEditRowValues()', () => {
  test('returns a copy of the stored values without edits', () => {
    const values = getBulkEditRowValues({ entry, locale: 'en', edits: undefined });

    expect(values).toEqual(entry.locales.en.content);
    expect(values).not.toBe(entry.locales.en.content);
  });

  test('applies the pending edits, replacing the items of an edited list', () => {
    expect(
      getBulkEditRowValues({
        entry,
        locale: 'en',
        edits: { category: 'events', tags: ['w'] },
      }),
    ).toEqual({ title: 'A', category: 'events', tags: ['w'], tagsets: 'z' });
  });

  test('returns the edits alone for a locale without content', () => {
    expect(getBulkEditRowValues({ entry, locale: 'fr', edits: { title: 'B' } })).toEqual({
      title: 'B',
    });
  });
});

describe('getBulkEditRowSlug()', () => {
  test('returns the localized slug, falling back to the canonical one', () => {
    expect(getBulkEditRowSlug(entry, 'ja')).toBe('a-ja');
    expect(getBulkEditRowSlug(entry, 'fr')).toBe('a');
  });
});
