// @vitest-environment happy-dom
/* eslint-disable no-script-url */
import { describe, expect, test } from 'vitest';

import { removeScriptURLs } from './script-urls';

describe('Test removeScriptURLs()', () => {
  test('should return HTML without a URL attribute as is', () => {
    const html = '<p title="javascript: tips">JavaScript:  <b>bold</b></p>';

    expect(removeScriptURLs(html)).toBe(html);
  });

  test('should return HTML without a `javascript:` URL as is', () => {
    const html = '<p><a href="https://example.com/?a=1&amp;b=2">x</a><img src="/a.png" alt=""></p>';

    expect(removeScriptURLs(html)).toBe(html);
  });

  test('should remove a `javascript:` link URL', () => {
    expect(removeScriptURLs('<p><a href="javascript:alert(1)">Click me</a></p>')).toBe(
      '<p><a>Click me</a></p>',
    );
  });

  test('should remove a `javascript:` URL however it’s written', () => {
    [
      '<a href="JavaScript:alert(1)">x</a>',
      '<a href=" \u0001javascript:alert(1)">x</a>',
      '<a href="java\tscr\nipt:alert(1)">x</a>',
      '<a href="&#106;avascript&colon;alert(1)">x</a>',
      '<a HREF="javascript:alert(1)">x</a>',
    ].forEach((html) => {
      expect(removeScriptURLs(html)).toBe('<a>x</a>');
    });
  });

  test('should remove `javascript:` URLs from every URL attribute', () => {
    const result = removeScriptURLs(
      '<iframe src="javascript:alert(1)"></iframe>' +
        '<object data="javascript:alert(1)"></object>' +
        '<form action="javascript:alert(1)"><button formaction="javascript:alert(1)">Go</button>' +
        '</form><svg><a xlink:href="javascript:alert(1)"><text>x</text></a>' +
        '<a><animate attributeName="href" values="#;javascript:alert(1)"/>' +
        '<set attributeName="href" to="javascript:alert(1)"/>' +
        '<animate attributeName="href" from="javascript:alert(1)" to="#"/><text>y</text></a></svg>',
    );

    expect(result).not.toContain('javascript:');
    expect(result).toContain('<button>Go</button>');
    expect(result).toContain('to="#"');
  });

  test('should keep any other attribute', () => {
    expect(
      removeScriptURLs('<a href="javascript:alert(1)" title="javascript:" onclick="f()">x</a>'),
    ).toBe('<a title="javascript:" onclick="f()">x</a>');
  });
});
