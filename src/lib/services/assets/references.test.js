// @vitest-environment happy-dom
// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getAssetReferences,
  getComparableAssetURL,
  getEntriesByAssets,
  getEntriesByAssetURL,
  getRichTextMediaSources,
  isInsideTag,
  MARKDOWN_IMAGE_REGEX,
  MARKDOWN_MEDIA_REGEX,
  replaceRichTextMediaSources,
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

describe('MARKDOWN_MEDIA_REGEX', () => {
  test('matches Markdown images and the start tags of media elements', () => {
    const text = [
      '![a](a.png) <IMG SRC="b.png" alt=\'a > b\'> <video poster=c.jpg>',
      '<source\nsrcset="d.png 2x"/> <audio src="e.mp3"></audio> <img/src=f.png>',
      '<imgur-embed src="g.png"> <p>Text</p> <img src="h.png"',
    ].join('');

    expect([...text.matchAll(MARKDOWN_MEDIA_REGEX)].map(([markup]) => markup)).toEqual([
      '![a](a.png)',
      '<IMG SRC="b.png" alt=\'a > b\'>',
      '<video poster=c.jpg>',
      '<source\nsrcset="d.png 2x"/>',
      '<audio src="e.mp3">',
      '<img/src=f.png>',
    ]);
  });

  test('doesn’t match a tag with `<` in an attribute value', () => {
    expect([...'<img alt="a<b" src="a.png">'.matchAll(MARKDOWN_MEDIA_REGEX)]).toEqual([]);
  });

  test('matches in linear time', () => {
    const text = `${'<img src="a.png" '.repeat(20000)}${'<video '.repeat(20000)}`;
    const start = performance.now();

    // None of the tags is closed
    expect([...text.matchAll(MARKDOWN_MEDIA_REGEX)]).toEqual([]);

    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe('getRichTextMediaSources()', () => {
  test('gets the Markdown image sources without duplicates', () => {
    expect(
      getRichTextMediaSources('![a](a.png) a.png ![b](b.png "Title") ![c](a.png)', 'markdown'),
    ).toEqual(['a.png', 'b.png']);
  });

  test('gets the URLs of the media elements written as raw HTML in Markdown', () => {
    const value = [
      '![a](a.png)\n\n<img src="a.png" srcset="b.png 2x, c&amp;d.png 3x">\n\n',
      '<video src="e.mp4" poster="f.jpg">\n<source src="g.webm">\n</video>\n',
      '<audio src="h.mp3"></audio> <img src=""> [i](i.png)',
    ].join('');

    expect(getRichTextMediaSources(value, 'markdown')).toEqual([
      'a.png',
      'b.png',
      'c&d.png',
      'e.mp4',
      'f.jpg',
      'g.webm',
      'h.mp3',
    ]);
  });

  test('gets the media URLs in HTML without duplicates, decoding character references', () => {
    const value = [
      '<p>Text <IMG SRC="a&amp;b.png" alt="a"><br/>',
      "<img src='c.png'><img src=d.png>",
      '<img src="a&amp;b.png"></p>',
      '<picture><source srcset="e.avif, f.avif 2x"><img src="c.png" srcset="g.png 800w"></picture>',
      '<video src="h.mp4" poster="i.jpg"><source src="j.webm"></video>',
      '<audio src="k.mp3"><source src="l.ogg"></audio>',
    ].join('');

    expect(getRichTextMediaSources(value, 'html')).toEqual([
      'a&b.png',
      'c.png',
      'd.png',
      'e.avif',
      'f.avif',
      'g.png',
      'h.mp4',
      'i.jpg',
      'j.webm',
      'k.mp3',
      'l.ogg',
    ]);
  });

  test('ignores a media tag in HTML that is not an element', () => {
    const value = [
      '<!-- <img src="comment.png"> -->',
      '<a title=\'<img src="attribute.png">\' href="link.png">Link</a>',
      '<script>document.write(\'<img src="script.png">\');</script>',
      '<img alt="No source"><img src=""><video poster="">',
      '<img src="real.png">',
    ].join('');

    expect(getRichTextMediaSources(value, 'html')).toEqual(['real.png']);
  });

  test('finds an image in an HTML table cell', () => {
    expect(getRichTextMediaSources('<tr><td><img src="cell.png"></td></tr>', 'html')).toEqual([
      'cell.png',
    ]);
  });

  test('returns an empty array for a body without media', () => {
    expect(getRichTextMediaSources('[a](a.png)', 'markdown')).toEqual([]);
    expect(getRichTextMediaSources('<p>Text</p>', 'html')).toEqual([]);
    expect(getRichTextMediaSources('<imgur-embed src="a.png"></imgur-embed>', 'html')).toEqual([]);
    expect(getRichTextMediaSources('', 'html')).toEqual([]);
  });

  test('ignores a raw tag inside another tag in Markdown', () => {
    const value = '<a title=\'<img src="a.png" alt="it&#39;s">\'>x</a> <img src="b.png">';

    expect(getRichTextMediaSources(value, 'markdown')).toEqual(['b.png']);
    // Not serialized again, which would break out of the title
    expect(replaceRichTextMediaSources(value, new Map([['a.png', 'c.png']]), 'markdown')).toBe(
      value,
    );
  });

  test('reads only the Markdown images and raw tags in Markdown, and only the tags in HTML', () => {
    const value = '![a](a.png) <img src="b.png">';

    expect(getRichTextMediaSources(value, 'markdown')).toEqual(['a.png', 'b.png']);
    expect(getRichTextMediaSources(value, 'html')).toEqual(['b.png']);
  });

  test('doesn’t run the scripts or event handlers in the HTML', () => {
    window.htmlImageTest = vi.fn();

    const value =
      '<img src="x.png" onerror="htmlImageTest()" onload="htmlImageTest()">' +
      '<video src="y.mp4" onerror="htmlImageTest()"></video><script>htmlImageTest()</script>';

    getRichTextMediaSources(value, 'html');
    getRichTextMediaSources(value, 'markdown');
    replaceRichTextMediaSources(value, new Map([['x.png', 'z.png']]), 'html');
    replaceRichTextMediaSources(value, new Map([['x.png', 'z.png']]), 'markdown');

    expect(window.htmlImageTest).not.toHaveBeenCalled();
    delete window.htmlImageTest;
  });
});

describe('isInsideTag()', () => {
  test('tells a tag in another tag’s attribute value from an element', () => {
    const value = '<a title=\'<img src="a.png">\'>x</a> a < b <img src="b.png">';

    expect(isInsideTag(value, value.indexOf('<img'))).toBe(true);
    expect(isInsideTag(value, value.lastIndexOf('<img'))).toBe(false);
    expect(isInsideTag('<img src="a.png">', 0)).toBe(false);
    expect(isInsideTag('text <', 6)).toBe(false);
  });
});

describe('replaceRichTextMediaSources()', () => {
  test('replaces the Markdown image sources within the images only', () => {
    const value = 'image.png ![image.png](image.png "image.png") ![a](hero-image.png) ![b](c.png)';

    expect(
      replaceRichTextMediaSources(
        value,
        new Map([
          ['image.png', 'blob:1'],
          ['c.png', undefined],
        ]),
        'markdown',
      ),
    ).toBe('image.png ![image.png](blob:1 "image.png") ![a](hero-image.png) ![b](c.png)');
  });

  test('replaces the URLs of the media elements written as raw HTML in Markdown', () => {
    const value = [
      'a.png ![a](a.png)\n\n<img alt="a.png" src="a.png" srcset="b.png 2x, a.png 3x" />\n\n',
      '<video poster=\'a.png\' controls>\n<source src="c.webm">\n</video>\n\n',
      "<audio src='d.mp3'></audio> <img src='e.png'>",
    ].join('');

    expect(
      replaceRichTextMediaSources(
        value,
        new Map([
          ['a.png', 'blob:a"b&c'],
          ['c.webm', 'f.webm'],
          ['e.png', undefined],
        ]),
        'markdown',
      ),
    ).toBe(
      [
        'a.png ![a](blob:a"b&c)\n\n',
        '<img alt="a.png" src="blob:a&quot;b&amp;c" srcset="b.png 2x, blob:a&quot;b&amp;c 3x">\n\n',
        '<video poster="blob:a&quot;b&amp;c" controls="">\n<source src="f.webm">\n</video>\n\n',
        "<audio src='d.mp3'></audio> <img src='e.png'>",
      ].join(''),
    );
  });

  test('replaces the media URLs in HTML only, escaping the new ones', () => {
    const value = [
      '<p>image.png <a href="image.png">image.png</a>',
      '<img src="image.png" alt="image.png"><img src="hero-image.png">',
      '<!-- <img src="image.png"> --><img src="c.png"></p>',
      '<picture><source srcset="image.png 1x, d.png 2x"></picture>',
      '<video src="image.png" poster="image.png"></video><audio src="image.png"></audio>',
    ].join('');

    expect(
      replaceRichTextMediaSources(
        value,
        new Map([
          ['image.png', 'blob:a"b&c'],
          ['c.png', undefined],
        ]),
        'html',
      ),
    ).toBe(
      [
        '<p>image.png <a href="image.png">image.png</a>',
        '<img src="blob:a&quot;b&amp;c" alt="image.png"><img src="hero-image.png">',
        '<!-- <img src="image.png"> --><img src="c.png"></p>',
        '<picture><source srcset="blob:a&quot;b&amp;c 1x, d.png 2x"></picture>',
        '<video src="blob:a&quot;b&amp;c" poster="blob:a&quot;b&amp;c"></video>',
        '<audio src="blob:a&quot;b&amp;c"></audio>',
      ].join(''),
    );
  });

  test('encodes whitespace in a new URL in a `srcset`', () => {
    expect(
      replaceRichTextMediaSources(
        '<img srcset="a.png 2x">',
        new Map([['a.png', 'my photo.png']]),
        'html',
      ),
    ).toBe('<img srcset="my%20photo.png 2x">');
  });

  test('matches a URL with character references decoded', () => {
    expect(
      replaceRichTextMediaSources(
        '<img src="a&amp;b.png">',
        new Map([['a&b.png', 'c.png']]),
        'html',
      ),
    ).toBe('<img src="c.png">');
  });

  test('returns the original value as is if no URL is replaced', () => {
    const value = "<p class='a'>Text<br/><img src='a.png' srcset='a.png 2x'></p>";

    expect(replaceRichTextMediaSources(value, new Map([['b.png', 'c.png']]), 'html')).toBe(value);
    expect(replaceRichTextMediaSources(value, new Map([['a.png', 'a.png']]), 'html')).toBe(value);
    expect(replaceRichTextMediaSources(value, new Map([['a.png', undefined]]), 'html')).toBe(value);
    expect(replaceRichTextMediaSources(value, new Map([['b.png', 'c.png']]), 'markdown')).toBe(
      value,
    );
    expect(replaceRichTextMediaSources('<p>Text</p>', new Map([['a.png', 'c.png']]), 'html')).toBe(
      '<p>Text</p>',
    );
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

  test('skips a value whose field is not configured or cannot hold an asset', async () => {
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
          en: { content: { unknown: 'test.jpg' }, slug: 'test', path: 'posts/test.md' },
        },
      },
    ];

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts', _type: 'entry' }]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue(undefined);

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toEqual([]);
    expect(getField).toHaveBeenCalledOnce();

    // A field that is neither a media field nor a rich text field, the widget defaulting to String
    vi.mocked(getField).mockReturnValue({ name: 'unknown' });

    expect(await getEntriesByAssetURL('test.jpg', { entries: mockEntries })).toEqual([]);
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
            // Two fields both containing the URL – only the first one should be looked at
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
    // What only depends on the collection and the entry is looked up once for both fields
    expect(vi.mocked(isCollectionIndexFile)).toHaveBeenCalledOnce();
    expect(vi.mocked(getCollectionFilesByEntry)).toHaveBeenCalledOnce();
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

  test('processes a non-matching field before a matching field', async () => {
    // A string field whose value contains the asset URL passes the pre-filter, but nothing matches
    // in a non-asset widget. The second field (image) matches.
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

    // description → no match (string widget); image → match
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
   * which is a Markdown field, and `html`, which is a RichText field in the HTML format.
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
    vi.mocked(getField).mockImplementation(({ keyPath }) =>
      keyPath === 'html'
        ? { name: keyPath, widget: 'richtext', format: 'html' }
        : { name: keyPath, widget: keyPath === 'body' ? 'markdown' : 'image' },
    );

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
      locale: 'en',
      value: 'photo.jpg',
    });
  });

  test('resolves a reference relative to the entry file of the locale holding it', async () => {
    const { getMediaFieldSource } = await setup();
    // With the `multiple_folders` i18n structure, each locale’s entry file has a folder of its own
    const asset = { path: 'posts/fr/a/photo.jpg', name: 'photo.jpg' };

    const a = {
      id: 'a',
      slug: 'a',
      subPath: 'a',
      locales: {
        en: { slug: 'a', path: 'posts/en/a/index.md', content: { cover: 'photo.jpg' } },
        fr: { slug: 'a', path: 'posts/fr/a/index.md', content: { cover: 'photo.jpg' } },
      },
    };

    vi.mocked(getMediaFieldSource).mockImplementation(({ locale }) =>
      locale === 'fr' ? { asset: { ...asset } } : undefined,
    );

    expect(await getAssetReferences([{ asset }], { entries: [a] })).toEqual([
      expect.objectContaining({ entry: a, locale: 'fr', keyPath: 'cover' }),
    ]);
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

  test('finds and replaces the media URLs in HTML and the raw HTML in Markdown', async () => {
    const { getField } = await setup();

    const content = {
      body: '![a](/uploads/1.jpg)\n\n<video src="/uploads/2.mp4" poster="/uploads/1.jpg"></video>',
      html: [
        '<p><a href="/uploads/1.jpg">/uploads/1.jpg</a>',
        '<img src="/uploads/9.jpg" srcset="/uploads/1.jpg 2x"></p>',
        '<audio><source src="/uploads/2.mp4"></audio>',
      ].join(''),
      other: '<p><img src="/uploads/9.jpg"></p>',
      note: '![x](/uploads/9.jpg)',
    };

    const a = createEntry('a', content);

    const results = await getEntriesByAssets(
      [
        { url: '/uploads/1.jpg', newURL: '/media/1.jpg' },
        { url: '/uploads/2.mp4', newURL: '/media/2.mp4' },
      ],
      { entries: [a] },
    );

    expect(results).toEqual([[a], [a]]);
    expect(content).toEqual({
      body: '![a](/media/1.jpg)\n\n<video src="/media/2.mp4" poster="/media/1.jpg"></video>',
      html: [
        '<p><a href="/uploads/1.jpg">/uploads/1.jpg</a>',
        '<img src="/uploads/9.jpg" srcset="/media/1.jpg 2x"></p>',
        '<audio><source src="/media/2.mp4"></audio>',
      ].join(''),
      other: '<p><img src="/uploads/9.jpg"></p>',
      note: '![x](/uploads/9.jpg)',
    });
    // A value whose media URLs can’t refer to the targets is skipped before the field lookup
    expect(getField).toHaveBeenCalledTimes(2);
  });

  test('reads an HTML value as HTML when looking for references', async () => {
    const { getField } = await setup();
    // In Markdown, the tag would be missed, as the attribute value contains `<`
    const a = createEntry('a', { html: '<img alt="a<b" src="/uploads/1.jpg">' });
    const b = createEntry('b', { html: '<img alt="a<b" src="/uploads/2.jpg">' });

    expect(await getEntriesByAssets([{ url: '/uploads/1.jpg' }], { entries: [a, b] })).toEqual([
      [a],
    ]);
    // The field is only looked up for the value referring to the target
    expect(getField).toHaveBeenCalledTimes(1);
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
