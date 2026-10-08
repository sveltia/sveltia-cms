import { describe, expect, it, vi } from 'vitest';

import {
  escapeAttr,
  escapeHTML,
  isNonEmptyString,
  makeLink,
  sanitizeInlineMarkdown,
} from '$lib/services/utils/string';

// Mimic a localization string that wraps the interpolated values in bidi isolates
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(
    (key, { values }) =>
      `${key}: \u2068${values.service}\u2069 <a \u2068${values.homeHref}\u2069>site</a> ` +
      `<a \u2068${values.apiKeyHref}\u2069 onclick="x()">key</a><img src="x">`,
  ),
}));

describe('isNonEmptyString', () => {
  it('returns true for non-empty strings', () => {
    expect(isNonEmptyString('hello')).toBe(true);
    expect(isNonEmptyString('  hello  ')).toBe(true);
  });

  it('returns false for empty or whitespace-only strings', () => {
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString('\n\t')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
    expect(isNonEmptyString({})).toBe(false);
  });
});

describe('escapeAttr', () => {
  it('should return the string unchanged when no special characters are present', () => {
    expect(escapeAttr('en')).toBe('en');
    expect(escapeAttr('https://example.com/style.css')).toBe('https://example.com/style.css');
  });

  it('should escape a bare & as &amp;', () => {
    expect(escapeAttr('a&b')).toBe('a&amp;b');
    expect(escapeAttr('a&b&c')).toBe('a&amp;b&amp;c');
  });

  it('should not double-encode pre-existing named entities', () => {
    expect(escapeAttr('Tom &amp; Jerry')).toBe('Tom &amp; Jerry');
    expect(escapeAttr('&lt;tag&gt;')).toBe('&lt;tag&gt;');
  });

  it('should not double-encode pre-existing numeric entities', () => {
    expect(escapeAttr('&#34;')).toBe('&#34;');
    expect(escapeAttr('&#x22;')).toBe('&#x22;');
  });

  it('should escape " as &quot;', () => {
    expect(escapeAttr('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('should escape both bare & and " in the same string', () => {
    expect(escapeAttr('"a&b"')).toBe('&quot;a&amp;b&quot;');
  });

  it('should handle a mix of bare & and pre-existing entity', () => {
    expect(escapeAttr('a & b &amp; c')).toBe('a &amp; b &amp; c');
  });

  it('should handle an empty string', () => {
    expect(escapeAttr('')).toBe('');
  });
});

describe('makeLink', () => {
  it('should replace <a> tag with href attribute', () => {
    const result = makeLink('Click <a>here</a>', 'https://example.com');

    expect(result).toContain('href="https://example.com"');
  });

  it('should add target="_blank" to the link', () => {
    const result = makeLink('Visit <a>our site</a>', 'https://example.com');

    expect(result).toContain('target="_blank"');
  });

  it('should preserve the link text', () => {
    const result = makeLink('Click <a>here</a> to continue', 'https://example.com');

    expect(result).toContain('here');
    expect(result).toContain('to continue');
  });

  it('should handle URLs with special characters', () => {
    const url = 'https://example.com?query=value&other=123#section';
    const result = makeLink('Link <a>text</a>', url);

    // Sanitizer converts & to &amp; in HTML attributes
    expect(result).toContain('href="https://example.com?query=value&amp;other=123#section"');
  });

  it('should sanitize HTML outside of allowed tags', () => {
    const result = makeLink(
      '<script>alert("xss")</script>Click <a>here</a>',
      'https://example.com',
    );

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('should preserve rel attribute if present', () => {
    const result = makeLink('Click <a>here</a>', 'https://example.com');

    expect(result).toContain('<a');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('should handle empty href gracefully', () => {
    const result = makeLink('Link <a>text</a>', '');

    expect(result).toContain('href=""');
  });

  it('should handle string with no <a> tag', () => {
    const result = makeLink('Plain text without link', 'https://example.com');

    // Text is preserved, but href is not added since there's no <a> tag
    expect(result).toContain('Plain text without link');
  });

  it('should replace only the first <a> tag if multiple exist', () => {
    const result = makeLink('First <a>link</a> and second <a>link</a>', 'https://example.com');
    // Only the first <a> should get the href replacement
    const hrefCount = (result.match(/href="/g) || []).length;

    expect(hrefCount).toBe(1);
  });

  it('should handle URLs with quotes and special HTML characters', () => {
    const url = 'https://example.com/path?q="test"&other=<value>';
    const result = makeLink('Link <a>here</a>', url);

    expect(result).toContain(
      'href="https://example.com/path?q=&quot;test&quot;&amp;other=<value>"',
    );
  });

  it('should not allow href values to inject attributes', () => {
    const result = makeLink('Link <a>text</a>', 'https://example.com" onclick="alert(1)');

    expect(result).toContain('href="https://example.com&quot; onclick=&quot;alert(1)"');
    expect(result).not.toContain('onclick="');
  });

  it('should remove potentially malicious onclick attributes', () => {
    const result = makeLink('Click <a onclick="alert()">here</a>', 'https://example.com');

    expect(result).not.toContain('onclick');
  });

  it('should handle href attribute in original tag', () => {
    // Original tag might have existing href that should be replaced
    const result = makeLink('Link <a>text</a>', 'https://example.com');

    expect(result).toContain('href="https://example.com"');
    expect(result).not.toContain('href="old"');
  });

  it('should preserve text content and structure', () => {
    const input = 'For more info, <a>read our guide</a> or contact support.';
    const result = makeLink(input, 'https://guide.example.com');

    expect(result).toContain('For more info,');
    expect(result).toContain('read our guide');
    expect(result).toContain('or contact support');
  });

  it('should handle internationalized URLs', () => {
    const url = 'https://example.com/文档';
    const result = makeLink('文档 <a>リンク</a>', url);

    expect(result).toContain('文档');
    expect(result).toContain('リンク');
  });

  it('should return a string', () => {
    const result = makeLink('Link <a>text</a>', 'https://example.com');

    expect(typeof result).toBe('string');
  });
});

describe('sanitizeInlineMarkdown', () => {
  it('should parse inline Markdown with the default allow-list', () => {
    expect(
      sanitizeInlineMarkdown('**a** _b_ ~~c~~ `d` [e](https://example.com) <br> <i>f</i>'),
    ).toBe(
      '<strong>a</strong> <em>b</em> <del>c</del> <code>d</code> ' +
        '<a href="https://example.com">e</a>  f',
    );
  });

  it('should strip disallowed attributes', () => {
    expect(sanitizeInlineMarkdown('<a href="/x" title="t" target="_blank">x</a>')).toBe(
      '<a href="/x">x</a>',
    );
  });

  it('should respect a custom allow-list', () => {
    expect(
      sanitizeInlineMarkdown('**a** `b` [c](/c)<br>', {
        allowedTags: ['a', 'code', 'br'],
      }),
    ).toBe('a <code>b</code> <a href="/c">c</a><br>');
    expect(
      sanitizeInlineMarkdown('<a href="/c" title="t">c</a>', {
        allowedTags: ['a'],
        allowedAttr: ['href', 'title'],
      }),
    ).toBe('<a href="/c" title="t">c</a>');
  });

  it('should remove scripts', () => {
    expect(sanitizeInlineMarkdown('<script>alert(1)</script>ok')).toBe('ok');
  });
});

describe('escapeHTML()', () => {
  it('should escape the characters read as markup, but not quotes', () => {
    expect(escapeHTML('Q&A <b> &amp; "x"')).toBe('Q&amp;A &lt;b&gt; &amp;amp; "x"');
  });
});
