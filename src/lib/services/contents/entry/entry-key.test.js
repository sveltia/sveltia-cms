import { describe, expect, test } from 'vitest';

import { getDraftEntryKey, getEntryKey } from '$lib/services/contents/entry/entry-key';

describe('entry keys', () => {
  test('name the entry or file, without the branch', () => {
    expect(getEntryKey('posts', 'hello')).toBe('posts/hello');
    expect(
      getDraftEntryKey(
        /** @type {any} */ ({ collectionName: 'posts', originalEntry: { subPath: 'a' } }),
      ),
    ).toBe('posts/a');
    expect(
      getDraftEntryKey(/** @type {any} */ ({ collectionName: 'pages', fileName: 'about' })),
    ).toBe('pages/about');
  });

  test('aren’t given to new entries, array items and missing drafts', () => {
    expect(getDraftEntryKey(undefined)).toBeUndefined();
    expect(getDraftEntryKey(/** @type {any} */ ({ isNew: true, collectionName: 'posts' }))).toBe(
      undefined,
    );
    expect(
      getDraftEntryKey(
        /** @type {any} */ ({
          collectionName: 'posts',
          originalEntry: { subPath: 'a', arrayIndex: 0 },
        }),
      ),
    ).toBeUndefined();
    expect(getDraftEntryKey(/** @type {any} */ ({ collectionName: 'pages' }))).toBeUndefined();
  });
});
