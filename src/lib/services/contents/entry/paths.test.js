import { describe, expect, it } from 'vitest';

import { getEntryPaths } from '$lib/services/contents/entry/paths';

/**
 * @import { Entry, UnpublishedEntry } from '$lib/types/private';
 */

describe('getEntryPaths()', () => {
  const entry = /** @type {UnpublishedEntry} */ (
    /** @type {unknown} */ ({
      locales: {
        en: { path: 'posts/new.en.md' },
        fr: { path: 'posts/new.fr.md' },
      },
      workflow: { previousPaths: ['posts/old.en.md', 'posts/new.fr.md'] },
    })
  );

  it('lists the current paths only by default', () => {
    expect(getEntryPaths(entry)).toEqual(['posts/new.en.md', 'posts/new.fr.md']);
  });

  it('includes the previous paths without duplicates when asked', () => {
    expect(getEntryPaths(entry, { includePrevious: true })).toEqual([
      'posts/new.en.md',
      'posts/new.fr.md',
      'posts/old.en.md',
    ]);
  });

  it('deduplicates the path shared by every locale of a single-file entry', () => {
    const singleFile = /** @type {Entry} */ (
      /** @type {unknown} */ ({
        locales: { en: { path: 'posts/a.md' }, fr: { path: 'posts/a.md' } },
      })
    );

    expect(getEntryPaths(singleFile)).toEqual(['posts/a.md']);
  });

  it('handles an entry without workflow details or previous paths', () => {
    const published = /** @type {Entry} */ (
      /** @type {unknown} */ ({ locales: { en: { path: 'posts/a.md' } } })
    );

    const noPrevious = /** @type {UnpublishedEntry} */ (
      /** @type {unknown} */ ({ locales: { en: { path: 'posts/a.md' } }, workflow: {} })
    );

    expect(getEntryPaths(published, { includePrevious: true })).toEqual(['posts/a.md']);
    expect(getEntryPaths(noPrevious, { includePrevious: true })).toEqual(['posts/a.md']);
  });
});
