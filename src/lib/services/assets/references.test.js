// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getAssetReferences,
  getComparableAssetURL,
  getEntriesByAssets,
  getEntriesByAssetURL,
  hasAsset,
  MARKDOWN_IMAGE_REGEX,
} from '$lib/services/assets/references';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';

// Mock dependencies
vi.mock('$lib/services/assets/media-field', () => ({
  getMediaFieldSource: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { current: undefined },
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/collections', () => ({
  getAssociatedCollections: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

describe('MARKDOWN_IMAGE_REGEX', () => {
  test('matches simple markdown image', () => {
    const text = '![alt text](image.jpg)';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('image.jpg');
  });

  test('matches markdown image with title', () => {
    const text = '![alt text](image.jpg "Title")';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('image.jpg');
  });

  test('matches multiple images', () => {
    const text = '![first](img1.jpg) and ![second](img2.png "Title")';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(2);
    expect(matches[0][1]).toBe('img1.jpg');
    expect(matches[1][1]).toBe('img2.png');
  });

  test('matches images with paths', () => {
    const text = '![alt](/assets/images/photo.jpg)';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('/assets/images/photo.jpg');
  });

  test('does not match incomplete images', () => {
    const text = '![alt text]';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(0);
  });

  test('matches images with an empty or bracketed alt text', () => {
    const text = '![](empty.jpg) ![see [1]](note.jpg) ![a]b](odd.jpg)';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches.map(([image, src]) => [image, src])).toEqual([
      ['![](empty.jpg)', 'empty.jpg'],
      ['![see [1]](note.jpg)', 'note.jpg'],
      ['![a]b](odd.jpg)', 'odd.jpg'],
    ]);
  });

  test('matches the source up to the title or the first closing parenthesis', () => {
    const text = [
      '![a](a.jpg "Title (with parens)")',
      '![b](b.jpg  "Escaped \\"quotes\\"")',
      "![c](c.jpg 'not a title')",
      '![d](d (1).jpg)',
      '![e](my image.jpg)',
      '![f](f.jpg\n"Title on the next line")',
      '![g](g.jpg "Unclosed title)',
    ].join(' ');

    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches.map(([, src]) => src)).toEqual([
      'a.jpg',
      'b.jpg',
      "c.jpg 'not a title'",
      'd (1',
      'my image.jpg',
      'f.jpg',
      'g.jpg "Unclosed title',
    ]);
  });

  test('matches an image within the alt text or source of an unclosed one', () => {
    const text = '![unclosed ![inner](inner.jpg) ![a](unclosed ![b](b.jpg)';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches.map(([image, src]) => [image, src])).toEqual([
      ['![inner](inner.jpg)', 'inner.jpg'],
      ['![b](b.jpg)', 'b.jpg'],
    ]);
  });

  test('does not match across lines or with an empty source', () => {
    const text = '![a\n](a.jpg) ![b](b.jpg\n) ![c]()';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(0);
  });

  test.each([
    ['unclosed images', '![a]('.repeat(20000)],
    ['unclosed alt texts', '!['.repeat(20000)],
    ['unclosed alt texts with a bracket at the end', `${'!['.repeat(20000)}]x`],
    ['bracketed alt texts', '![a]'.repeat(20000)],
    ['unclosed titles', `![a](x${' "'.repeat(20000)}`],
    ['unclosed images with titles', '![a](x "'.repeat(20000)],
    ['spaces before an unclosed title', `![a](x${' '.repeat(20000)}"${'a'.repeat(20000)}`],
    ['escaped quotes', `![a](x "${'\\"'.repeat(20000)}`],
  ])('matches in linear time: %s', (_label, text) => {
    const start = performance.now();
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];
    const duration = performance.now() - start;

    expect(matches).toHaveLength(0);
    // The previous pattern took well over a minute with some of these inputs
    expect(duration).toBeLessThan(200);
  });
});

describe('hasAsset()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  test('returns false when field not found', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');

    vi.mocked(getField).mockReturnValue(undefined);

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'image',
      value: 'image.jpg',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('matches image field with direct URL', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'image',
      widget: 'image',
    });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'image.jpg' });

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'image',
      value: 'image.jpg',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('matches images in markdown content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'image.jpg' });

    const content = {};

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'Here is an image: ![alt](image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('returns false for non-string values', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');

    vi.mocked(getField).mockReturnValue({
      name: 'number_field',
      widget: 'number',
    });

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'number_field',
      value: 123, // Non-string value
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('returns false for empty string values', async () => {
    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'empty_field',
      value: '', // Empty string
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('handles newURL parameter for image fields', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'image',
      widget: 'image',
    });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'image.jpg' });

    const content = {};

    const args = {
      assetURL: 'image.jpg',
      newURL: 'new-image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'image',
      value: 'image.jpg',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.image).toBe('new-image.jpg');
  });

  test('handles newURL parameter for markdown content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'image.jpg' });

    const content = { body: 'Here is an image: ![alt](image.jpg)' };

    const args = {
      assetURL: 'image.jpg',
      newURL: 'new-image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'Here is an image: ![alt](image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.body).toBe('Here is an image: ![alt](new-image.jpg)');
  });

  test('replaces the URL within the matched images only', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');

    vi.mocked(getField).mockReturnValue({ name: 'body', widget: 'markdown' });

    // A link to the same file comes first, the new URL contains the old one, the image is used
    // twice, its alt text holds the URL, and the new URL holds a replacement pattern
    const value = '[Download](/a.png) ![/a.png](/a.png) ![alt](/a.png "Title") ![other](/b.png)';
    const content = { body: value };

    const args = {
      assetURL: '/a.png',
      newURL: '/img/$&/a.png',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: { en: { content: {}, slug: 'test', path: 'posts/test.md' } },
      },
      content,
      keyPath: 'body',
      value,
      isIndexFile: false,
    };

    expect(hasAsset(args)).toBe(true);
    // Running it again, as done for each collection the entry belongs to, changes nothing more
    expect(hasAsset(args)).toBe(true);
    expect(content.body).toBe(
      '[Download](/a.png) ![/a.png](/img/$&/a.png) ![alt](/img/$&/a.png "Title") ![other](/b.png)',
    );
  });

  test('leaves the markdown content alone without newURL', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');

    vi.mocked(getField).mockReturnValue({ name: 'body', widget: 'markdown' });

    const value = '![alt](/a.png)';
    const content = { body: value };

    const args = {
      assetURL: '/a.png',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: { en: { content: {}, slug: 'test', path: 'posts/test.md' } },
      },
      content,
      keyPath: 'body',
      value,
      isIndexFile: false,
    };

    expect(hasAsset(args)).toBe(true);
    expect(content.body).toBe(value);
  });

  test('handles markdown with multiple images', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });
    vi.mocked(getMediaFieldSource)
      .mockReturnValueOnce({ url: 'image1.jpg' })
      .mockReturnValueOnce({ url: 'image2.jpg' });

    const content = { body: 'First: ![alt](image1.jpg) Second: ![alt](image2.jpg)' };

    const args = {
      assetURL: 'image1.jpg',
      newURL: 'new-image1.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'First: ![alt](image1.jpg) Second: ![alt](image2.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.body).toBe('First: ![alt](new-image1.jpg) Second: ![alt](image2.jpg)');
  });

  test('handles markdown with no matching images', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'other.jpg' });

    const args = {
      assetURL: 'target.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Here is an image: ![alt](other.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('handles blob URLs in image fields', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'image',
      widget: 'image',
    });

    // For blob URLs, getMediaFieldSource should resolve the value as-is
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'blob:image.jpg' });

    const args = {
      assetURL: 'blob:image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'image',
      value: 'blob:image.jpg',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('compares the blob URL of the asset an entry-relative path resolves to', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const args = {
      assetURL: 'blob:image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: { en: { content: {}, slug: 'test', path: 'posts/test.md' } },
      },
      content: {},
      keyPath: 'image',
      value: 'image.jpg',
      isIndexFile: false,
    };

    // The asset is resolved without loading it, so only one already holding the URL matches
    vi.mocked(getMediaFieldSource).mockReturnValue({
      asset: /** @type {any} */ ({ path: 'posts/image.jpg', blobURL: 'blob:image.jpg' }),
    });
    expect(hasAsset(args)).toBe(true);

    vi.mocked(getMediaFieldSource).mockReturnValue({
      asset: /** @type {any} */ ({ path: 'posts/other.jpg' }),
    });
    expect(hasAsset(args)).toBe(false);

    vi.mocked(getMediaFieldSource).mockReturnValue(undefined);
    expect(hasAsset(args)).toBe(false);
  });

  test('handles blob URLs in markdown content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });

    // For blob URLs, getMediaFieldSource should resolve the value as-is
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'blob:image.jpg' });

    const args = {
      assetURL: 'blob:image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Here is an image: ![alt](blob:image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('matches images in richtext content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'image.jpg' });

    const content = {};

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'Here is an image: ![alt](image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('handles newURL parameter for richtext content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'image.jpg' });

    const content = { body: 'Here is an image: ![alt](image.jpg)' };

    const args = {
      assetURL: 'image.jpg',
      newURL: 'new-image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'Here is an image: ![alt](image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.body).toBe('Here is an image: ![alt](new-image.jpg)');
  });

  test('handles richtext with multiple images', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });
    vi.mocked(getMediaFieldSource)
      .mockReturnValueOnce({ url: 'image1.jpg' })
      .mockReturnValueOnce({ url: 'image2.jpg' });

    const content = { body: 'First: ![alt](image1.jpg) Second: ![alt](image2.jpg)' };

    const args = {
      assetURL: 'image1.jpg',
      newURL: 'new-image1.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'First: ![alt](image1.jpg) Second: ![alt](image2.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.body).toBe('First: ![alt](new-image1.jpg) Second: ![alt](image2.jpg)');
  });

  test('handles richtext with no matching images', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'other.jpg' });

    const args = {
      assetURL: 'target.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Here is an image: ![alt](other.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('handles blob URLs in richtext content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });

    // For blob URLs, getMediaFieldSource should resolve the value as-is
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'blob:image.jpg' });

    const args = {
      assetURL: 'blob:image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Here is an image: ![alt](blob:image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('returns false for richtext field with no image syntax (line 159 false branch)', async () => {
    // When the markdown body has no images, `matches.length` = 0 → the if block
    // is NOT taken → falls through to `return false` at line 178.
    const { getField } = await import('$lib/services/contents/entry/fields');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });

    const args = {
      assetURL: 'target.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: { content: {}, slug: 'test', path: 'posts/test.md' },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Just plain text, no image syntax here.',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    // matches.length = 0 (no markdown image syntax) → if block skipped → returns false
    expect(result).toBe(false);
  });
});

describe('getEntriesByAssetURL()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('finds entries with asset URL', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg', body: 'Hello world' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('returns empty array when no entries match', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'other.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'other.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(0);
  });

  test('handles blob URLs correctly', async () => {
    cmsConfig.current = { _baseURL: 'https://example.com' };

    const result = await getEntriesByAssetURL('blob:test.jpg', { entries: [] });

    expect(result).toHaveLength(0);
  });

  test('handles baseURL replacement', async () => {
    cmsConfig.current = { _baseURL: 'https://example.com/' };

    const result = await getEntriesByAssetURL('https://example.com/test.jpg', { entries: [] });

    expect(result).toHaveLength(0);
  });

  test('skips entries with non-string content values', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {
              image: 'test.jpg',
              count: 42, // Non-string value
              enabled: true, // Non-string value
            },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('skips entries with empty string content values', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {
              image: 'test.jpg',
              emptyField: '', // Empty string - should be skipped
              anotherEmpty: '', // Another empty string
            },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('handles file collections with collectionFiles', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg' },
            slug: 'test',
            path: 'config/main.yml',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'config',
      _type: 'file',
    };

    const mockCollectionFile = {
      name: 'main',
      file: 'config/main.yml',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([mockCollectionFile]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('handles multiple locales with different content', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg', title: 'English title' },
            slug: 'test',
            path: 'posts/test.md',
          },
          ja: {
            content: { image: 'other.jpg', title: '日本語タイトル' },
            slug: 'test',
            path: 'posts/test.ja.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('pre-filters fields that cannot contain the asset URL', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg', title: 'My post', body: 'Some long body text' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    // getField should only be called for the 'image' field, not 'title' or 'body'
    expect(vi.mocked(getField)).toHaveBeenCalledTimes(1);
  });

  test('short-circuits after first match when not replacing', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            // Two fields both containing the URL – hasAsset should only be called once
            content: { image1: 'test.jpg', image2: 'test.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    // Short-circuits after the first matching field, so getField is only called once
    expect(vi.mocked(getField)).toHaveBeenCalledTimes(1);
  });

  test('does not short-circuit when replacing (processes all matching fields)', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const content = { image1: 'test.jpg', image2: 'test.jpg' };

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: { content, slug: 'test', path: 'posts/test.md' },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    await getEntriesByAssetURL('test.jpg', { entries: mockEntries, newURL: 'new.jpg' });

    // Both matching fields must be processed so both get replaced
    expect(vi.mocked(getField)).toHaveBeenCalledTimes(2);
    expect(content.image1).toBe('new.jpg');
    expect(content.image2).toBe('new.jpg');
  });

  test('skips non-string values that come first (line 206 branch 0)', async () => {
    // When a non-string value is the FIRST key in content, it triggers line 206’s continue
    // before the loop can break early. The numeric `count` key is processed first,
    // which forces `typeof 42 !== 'string'` = true → continue (branch 0).
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            // count (non-string) is inserted FIRST so it’s iterated before image
            content: { count: 42, image: 'target.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const result = await getEntriesByAssetURL('target.jpg', { entries: mockEntries });

    // count:42 → continue (line 206 branch 0); image:‘target.jpg’ → found
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('processes fields where hasAsset returns false before a matching field (line 238 false branch)', async () => {
    // A string field whose value contains the asset URL passes the pre-filter at
    // line 209, but `hasAsset` returns false for a non-asset widget (line 178),
    // causing `matched = false` → `if (matched)` false branch at line 238.
    // The second field (image) matches and sets found = true.
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            // description contains the URL but is a string field (not image)
            content: { description: 'See target.jpg for more', image: 'target.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockImplementation(({ keyPath }) => {
      if (keyPath === 'description') return { name: 'description', widget: 'string' };
      if (keyPath === 'image') return { name: 'image', widget: 'image' };

      return undefined;
    });

    const result = await getEntriesByAssetURL('target.jpg', { entries: mockEntries });

    // description → hasAsset returns false (string widget), matched=false (line 238 false branch)
    // image → hasAsset returns true, found=true
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('getAssetReferences()', () => {
  /**
   * Set the mocks up for a `posts` entry collection whose every field is an Image field.
   * @returns {Promise<{ getField: any, getCollectionFilesByEntry: any }>} Mocks.
   */
  const setup = async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts', _type: 'entry' }]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockImplementation(({ keyPath }) => ({ name: keyPath, widget: 'image' }));

    return { getField, getCollectionFilesByEntry };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('reports every field holding the asset, in every locale', async () => {
    await setup();

    const entry = {
      id: '1',
      slug: 'test',
      subPath: 'test',
      locales: {
        en: { content: { cover: 'a.jpg', 'gallery.0': 'b.jpg', 'gallery.1': 'a.jpg' } },
        fr: { content: { cover: 'a.jpg' } },
      },
    };

    const references = await getAssetReferences([{ url: 'a.jpg' }], { entries: [entry] });

    expect(references).toEqual([
      {
        entry,
        collection: { name: 'posts', _type: 'entry' },
        collectionFile: undefined,
        locale: 'en',
        keyPath: 'cover',
        fieldConfig: { name: 'cover', widget: 'image' },
      },
      expect.objectContaining({ locale: 'en', keyPath: 'gallery.1' }),
      expect.objectContaining({ locale: 'fr', keyPath: 'cover' }),
    ]);
  });

  test('reports nothing when no entry holds the asset', async () => {
    await setup();

    const entry = { id: '1', slug: 'test', subPath: 'test', locales: { en: { content: {} } } };

    expect(await getAssetReferences([{ url: 'a.jpg' }], { entries: [entry] })).toEqual([]);
  });

  test('reports the collection file the field belongs to', async () => {
    const { getCollectionFilesByEntry } = await setup();
    const collectionFile = { name: 'general' };

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([collectionFile]);

    const entry = {
      id: '1',
      slug: 'general',
      subPath: 'general',
      locales: { en: { content: { logo: 'a.jpg' } } },
    };

    const references = await getAssetReferences([{ url: 'a.jpg' }], { entries: [entry] });

    expect(references).toEqual([expect.objectContaining({ collectionFile, keyPath: 'logo' })]);
  });

  test('searches the loaded entries by default', async () => {
    await setup();

    allEntries.current = [
      { id: '1', slug: 'test', subPath: 'test', locales: { en: { content: { cover: 'a.jpg' } } } },
    ];

    expect(await getAssetReferences([{ url: 'a.jpg' }])).toHaveLength(1);
    allEntries.current = undefined;
  });
});

describe('getComparableAssetURL()', () => {
  test('drops the site’s base URL, as a stored value does', () => {
    cmsConfig.current = { _baseURL: 'https://example.com' };
    expect(getComparableAssetURL('https://example.com/uploads/a.jpg')).toBe('/uploads/a.jpg');
    // A blob URL is left alone, even when it’s on the same origin
    expect(getComparableAssetURL('blob:https://example.com/abc')).toBe(
      'blob:https://example.com/abc',
    );
  });

  test('leaves the URL alone without a base URL', () => {
    cmsConfig.current = undefined;
    expect(getComparableAssetURL('/uploads/a.jpg')).toBe('/uploads/a.jpg');
  });
});

describe('getEntriesByAssets()', () => {
  /**
   * Set the mocks up for a `posts` entry collection whose fields are Image fields, except `body`,
   * which is a Markdown field.
   * @returns {Promise<{ getField: any, getMediaFieldSource: any }>} Mocks.
   */
  const setup = async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts', _type: 'entry' }]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockImplementation(({ keyPath }) => ({
      name: keyPath,
      widget: keyPath === 'body' ? 'markdown' : 'image',
    }));

    return { getField, getMediaFieldSource };
  };

  /**
   * Create an entry.
   * @param {string} id ID.
   * @param {Record<string, any>} content Content.
   * @returns {object} Entry.
   */
  const createEntry = (id, content) => ({
    id,
    slug: id,
    subPath: id,
    locales: { en: { slug: id, path: `posts/${id}/index.md`, content } },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('finds the entries holding each target in one pass', async () => {
    const { getField } = await setup();
    const a = createEntry('a', { cover: '/uploads/1.jpg', thumb: '/uploads/2.jpg' });
    const b = createEntry('b', { cover: '/uploads/2.jpg', title: 'Nothing here' });
    const c = createEntry('c', { body: 'Hi ![one](/uploads/1.jpg "One")' });

    const results = await getEntriesByAssets(
      [
        { url: 'https://example.com/uploads/1.jpg' },
        { url: '/uploads/2.jpg' },
        { url: '/uploads/3.jpg' },
      ],
      { entries: [a, b, c] },
    );

    expect(results).toEqual([[a, c], [a, b], []]);
    // Each value that can refer to a target is looked at once, however many targets there are
    expect(getField).toHaveBeenCalledTimes(4);
  });

  test('stops searching an entry once every target has been found in it', async () => {
    const { getField } = await setup();
    const a = createEntry('a', { cover: '/uploads/1.jpg', thumb: '/uploads/1.jpg' });

    expect(await getEntriesByAssets([{ url: '/uploads/1.jpg' }], { entries: [a] })).toEqual([[a]]);
    expect(getField).toHaveBeenCalledTimes(1);
  });

  test('reports an entry for every target sharing a URL', async () => {
    await setup();

    const a = createEntry('a', { cover: '/uploads/1.jpg' });
    const targets = [{ url: '/uploads/1.jpg' }, { url: '/uploads/1.jpg' }];

    expect(await getEntriesByAssets(targets, { entries: [a] })).toEqual([[a], [a]]);
  });

  test('matches an asset without a URL by the asset its references resolve to', async () => {
    const { getMediaFieldSource } = await setup();
    // The asset has never been loaded, so it has no blob URL to compare with
    const asset = { path: 'posts/a/photo.jpg', name: 'photo.jpg' };
    const a = createEntry('a', { cover: 'photo.jpg', body: '![p](photo.jpg) and ![o](other.jpg)' });
    const b = createEntry('b', { cover: 'photo.jpg' });

    vi.mocked(getMediaFieldSource).mockImplementation(({ entry, value }) =>
      entry.id === 'a' && value === 'photo.jpg' ? { asset: { ...asset } } : undefined,
    );

    expect(await getEntriesByAssets([{ asset }], { entries: [a, b] })).toEqual([[a]]);
    expect(getMediaFieldSource).toHaveBeenCalledWith({
      entry: a,
      collectionName: 'posts',
      fileName: undefined,
      value: 'photo.jpg',
    });
  });

  test('replaces the references to each target with its own new URL', async () => {
    const { getMediaFieldSource } = await setup();
    const asset = { path: 'posts/a/photo.jpg', name: 'photo.jpg' };

    const content = {
      cover: 'photo.jpg',
      thumb: '/uploads/1.jpg',
      other: '/uploads/9.jpg',
      body: '[link](photo.jpg) ![p](photo.jpg) ![one](/uploads/1.jpg) ![o](other.jpg)',
    };

    const a = createEntry('a', content);

    vi.mocked(getMediaFieldSource).mockImplementation(({ value }) =>
      value === 'photo.jpg' ? { asset } : { url: value },
    );

    const results = await getEntriesByAssets(
      [
        { asset, newURL: 'images/photo.jpg' },
        { url: '/uploads/1.jpg', newURL: '/media/1.jpg' },
      ],
      { entries: [a] },
    );

    expect(results).toEqual([[a], [a]]);
    expect(content).toEqual({
      cover: 'images/photo.jpg',
      thumb: '/media/1.jpg',
      other: '/uploads/9.jpg',
      body: '[link](photo.jpg) ![p](images/photo.jpg) ![one](/media/1.jpg) ![o](other.jpg)',
    });
  });

  test('replaces a reference with the URL a function returns for it', async () => {
    const { getMediaFieldSource } = await setup();
    const asset = { path: 'posts/a/photo.jpg', name: 'photo.jpg' };
    const content = { cover: './photo.jpg', body: '![p](photo.jpg) ![q](sub/photo.jpg)' };
    const a = createEntry('a', content);

    vi.mocked(getMediaFieldSource).mockImplementation(({ value }) =>
      value.endsWith('photo.jpg') ? { asset } : undefined,
    );

    /**
     * Rename the photo, except in a subfolder.
     * @param {string} src Reference.
     * @returns {string | undefined} New reference.
     */
    const newURL = (src) => (src.startsWith('sub/') ? undefined : src.replace('photo', 'image'));

    await getEntriesByAssets([{ asset, newURL }], { entries: [a] });

    // A reference the function gives no URL for is left alone
    expect(content).toEqual({ cover: './image.jpg', body: '![p](image.jpg) ![q](sub/photo.jpg)' });
  });

  test('leaves the references to a target without a new URL alone', async () => {
    await setup();

    const content = {
      cover: '/uploads/1.jpg',
      body: '![one](/uploads/1.jpg) ![two](/uploads/2.jpg)',
    };

    const a = createEntry('a', content);

    await getEntriesByAssets(
      [{ url: '/uploads/1.jpg' }, { url: '/uploads/2.jpg', newURL: '/media/2.jpg' }],
      { entries: [a] },
    );

    expect(content).toEqual({
      cover: '/uploads/1.jpg',
      body: '![one](/uploads/1.jpg) ![two](/media/2.jpg)',
    });
  });

  test('searches the loaded entries by default', async () => {
    await setup();

    allEntries.current = [createEntry('a', { cover: '/uploads/1.jpg' })];
    expect(await getEntriesByAssets([{ url: '/uploads/1.jpg' }])).toEqual([allEntries.current]);
    allEntries.current = undefined;
  });
});

describe('getAssetReferences() with several targets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('reports a field holding several of the targets once', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts', _type: 'entry' }]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'body', widget: 'markdown' });

    const entry = {
      id: '1',
      slug: 'test',
      subPath: 'test',
      locales: { en: { content: { body: '![a](a.jpg) ![b](b.jpg)', title: 'a.jpg' } } },
    };

    const references = await getAssetReferences([{ url: 'a.jpg' }, { url: 'b.jpg' }], {
      entries: [entry],
    });

    expect(references).toEqual([expect.objectContaining({ locale: 'en', keyPath: 'body' })]);
  });
});
