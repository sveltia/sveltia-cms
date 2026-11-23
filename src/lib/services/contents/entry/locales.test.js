// @ts-nocheck
import { describe, expect, test } from 'vitest';

import { mapEntryContent } from '$lib/services/contents/entry/locales';

describe('Test mapEntryContent()', () => {
  test('should replace the content of the locales that have content', () => {
    const entry = {
      id: 'foo',
      locales: {
        en: { slug: 'foo', path: 'foo.en.md', content: { title: 'Foo' } },
        fr: { path: 'foo.fr.md' },
      },
    };

    const result = mapEntryContent(entry, ({ locale, localizedEntry: { slug, content } }) => ({
      ...content,
      note: `${locale}:${slug}`,
    }));

    expect(result).toEqual({
      id: 'foo',
      locales: {
        en: { slug: 'foo', path: 'foo.en.md', content: { title: 'Foo', note: 'en:foo' } },
        fr: { path: 'foo.fr.md' },
      },
    });
    expect(entry.locales.en.content).toEqual({ title: 'Foo' });
  });
});
