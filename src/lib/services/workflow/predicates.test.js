import { describe, expect, test } from 'vitest';

import { isUnpublishedEntry } from '$lib/services/workflow/predicates';

describe('isUnpublishedEntry()', () => {
  test('tells an unpublished entry from a published one', () => {
    const entry = /** @type {any} */ ({ id: 'a', slug: 'a', subPath: 'a', locales: {} });

    expect(isUnpublishedEntry(entry)).toBe(false);
    expect(isUnpublishedEntry({ ...entry, workflow: undefined })).toBe(false);
    expect(isUnpublishedEntry({ ...entry, workflow: { status: 'draft' } })).toBe(true);
  });

  test('accepts a missing entry', () => {
    expect(isUnpublishedEntry(undefined)).toBe(false);
    expect(isUnpublishedEntry(null)).toBe(false);
  });
});
