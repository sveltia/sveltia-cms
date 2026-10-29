// @vitest-environment happy-dom
// @ts-nocheck
/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, test, vi } from 'vitest';

import {
  getRichTextMediaSources,
  MARKDOWN_IMAGE_REGEX,
  MARKDOWN_MEDIA_REGEX,
  replaceRichTextMediaSources,
  rewriteMediaStartTag,
} from '$lib/services/contents/fields/rich-text/previews/media-sources';
import { countMatches, expectLinearTime } from '$lib/test/complexity';

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
    ['unclosed images', (n) => '![a]('.repeat(n)],
    ['unclosed alt texts', (n) => '!['.repeat(n)],
    ['unclosed alt texts with a bracket at the end', (n) => `${'!['.repeat(n)}]x`],
    ['bracketed alt texts', (n) => '![a]'.repeat(n)],
    ['unclosed titles', (n) => `![a](x${' "'.repeat(n)}`],
    ['unclosed images with titles', (n) => '![a](x "'.repeat(n)],
    ['spaces before an unclosed title', (n) => `![a](x${' '.repeat(n)}"${'a'.repeat(n)}`],
    ['escaped quotes', (n) => `![a](x "${'\\"'.repeat(n)}`],
  ])('matches in linear time: %s', (_label, build) => {
    expect(countMatches(build(100), MARKDOWN_IMAGE_REGEX)).toBe(0);
    // The previous pattern took well over a minute with some of these inputs
    expectLinearTime(build, (text) => countMatches(text, MARKDOWN_IMAGE_REGEX), 100);
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
    const build = (n) => `${'<img src="a.png" '.repeat(n)}${'<video '.repeat(n)}`;

    // None of the tags is closed
    expect(countMatches(build(100), MARKDOWN_MEDIA_REGEX)).toBe(0);
    expectLinearTime(build, (text) => countMatches(text, MARKDOWN_MEDIA_REGEX), 1000);
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

describe('rewriteMediaStartTag()', () => {
  const tag = '<img src="a.png" alt="x">';

  test('returns the element with the URLs updated', () => {
    const element = rewriteMediaStartTag({
      value: tag,
      tag,
      index: 0,
      callback: () => 'b.png',
    });

    expect(element?.getAttribute('src')).toBe('b.png');
  });

  test('returns nothing if no URL is changed', () => {
    expect(
      rewriteMediaStartTag({
        value: tag,
        tag,
        index: 0,
        callback: () => undefined,
      }),
    ).toBeUndefined();
  });

  test('returns nothing for a tag inside another tag', () => {
    const value = `<a title='${tag}'>x</a>`;

    expect(
      rewriteMediaStartTag({
        value,
        tag,
        index: value.indexOf('<img'),
        callback: () => 'b.png',
      }),
    ).toBeUndefined();
  });
});
