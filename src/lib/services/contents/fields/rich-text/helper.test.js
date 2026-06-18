/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, it, vi } from 'vitest';

import {
  buildMarkdownWithPreviews,
  encodeImageSrc,
  sanitizeRichTextHTML,
  splitMarkdownBlocks,
} from './helper.js';

describe('encodeImageSrc', () => {
  it('should encode spaces in image URLs without title', () => {
    // Simulate regex match args with groups for alt and src
    const args = [
      '![alt text](my image.png)',
      'alt text',
      'my image.png',
      '',
      {
        alt: 'alt text',
        src: 'my image.png',
        title: undefined,
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![alt text](my%20image.png)');
  });

  it('should encode spaces in image URLs with title', () => {
    // Simulate regex match args with groups for alt, src, and title
    const args = [
      '![alt text](my image.png "Image Title")',
      'alt text',
      'my image.png',
      'Image Title',
      {
        alt: 'alt text',
        src: 'my image.png',
        title: 'Image Title',
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![alt text](my%20image.png "Image Title")');
  });

  it('should encode multiple spaces in image URLs', () => {
    const args = [
      '![test](folder name/sub folder/image file.jpg)',
      'test',
      'folder name/sub folder/image file.jpg',
      '',
      {
        alt: 'test',
        src: 'folder name/sub folder/image file.jpg',
        title: undefined,
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![test](folder%20name/sub%20folder/image%20file.jpg)');
  });

  it('should handle URLs without spaces', () => {
    const args = [
      '![no spaces](image.png)',
      'no spaces',
      'image.png',
      '',
      {
        alt: 'no spaces',
        src: 'image.png',
        title: undefined,
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![no spaces](image.png)');
  });

  it('should handle URLs without spaces but with title', () => {
    const args = [
      '![no spaces](image.png "Title")',
      'no spaces',
      'image.png',
      'Title',
      {
        alt: 'no spaces',
        src: 'image.png',
        title: 'Title',
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![no spaces](image.png "Title")');
  });

  it('should handle empty alt text', () => {
    const args = [
      '![](my image.png)',
      '',
      'my image.png',
      '',
      {
        alt: '',
        src: 'my image.png',
        title: undefined,
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![](my%20image.png)');
  });

  it('should handle URLs with already encoded spaces', () => {
    const args = [
      '![test](my%20image.png)',
      'test',
      'my%20image.png',
      '',
      {
        alt: 'test',
        src: 'my%20image.png',
        title: undefined,
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![test](my%20image.png)');
  });

  it('should handle complex alt text with special characters', () => {
    const args = [
      '![Alt with "quotes" & symbols](my image.png)',
      'Alt with "quotes" & symbols',
      'my image.png',
      '',
      {
        alt: 'Alt with "quotes" & symbols',
        src: 'my image.png',
        title: undefined,
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![Alt with "quotes" & symbols](my%20image.png)');
  });

  it('should handle title with special characters', () => {
    const args = [
      '![test](my image.png "Title with "quotes"")',
      'test',
      'my image.png',
      'Title with "quotes"',
      {
        alt: 'test',
        src: 'my image.png',
        title: 'Title with "quotes"',
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![test](my%20image.png "Title with "quotes"")');
  });

  it('should handle absolute file paths with spaces', () => {
    const args = [
      '![test](/path/to/my image.png)',
      'test',
      '/path/to/my image.png',
      '',
      {
        alt: 'test',
        src: '/path/to/my image.png',
        title: undefined,
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![test](/path/to/my%20image.png)');
  });

  it('should handle URLs with query parameters containing spaces', () => {
    const args = [
      '![test](image.png?param=value with space)',
      'test',
      'image.png?param=value with space',
      '',
      {
        alt: 'test',
        src: 'image.png?param=value with space',
        title: undefined,
      },
    ];

    const result = encodeImageSrc(...args);

    expect(result).toBe('![test](image.png?param=value%20with%20space)');
  });
});

describe('buildMarkdownWithPreviews', () => {
  it('should return the original markdown when there are no component defs', () => {
    const { markdown, previewMap } = buildMarkdownWithPreviews('Hello **world**', []);

    expect(markdown).toBe('Hello **world**');
    expect(previewMap.size).toBe(0);
  });

  it('should return empty string when currentValue is undefined', () => {
    const { markdown, previewMap } = buildMarkdownWithPreviews(undefined, []);

    expect(markdown).toBe('');
    expect(previewMap.size).toBe(0);
  });

  it('should inline a string preview directly in the markdown', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'note',
        label: 'Note',
        fields: [],
        pattern: /\[note\](?<content>.*?)\[\/note\]/gs,
        toBlock: ({ content }) => `[note]${content}[/note]`,
        toPreview: ({ content }) => `<div class="note">${content}</div>`,
      },
    ];

    const { markdown, previewMap } = buildMarkdownWithPreviews('[note]Hello[/note]', componentDefs);

    expect(previewMap.size).toBe(1);
    expect(markdown).toBe('<div class="note">Hello</div>');

    const [key] = previewMap.keys();

    expect(previewMap.get(key)).toBe('<div class="note">Hello</div>');
  });

  it('should replace a React element preview with a placeholder span', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'note',
        label: 'Note',
        fields: [],
        pattern: /\[note\](?<content>.*?)\[\/note\]/gs,
        toBlock: ({ content }) => `[note]${content}[/note]`,
        // Simulate a React element (non-string) preview
        toPreview: ({ content }) =>
          /** @type {import('react').ReactElement} */ (
            /** @type {unknown} */ ({ type: 'div', props: { children: content } })
          ),
      },
    ];

    const { markdown, previewMap } = buildMarkdownWithPreviews('[note]Hello[/note]', componentDefs);

    expect(previewMap.size).toBe(1);
    expect(markdown).toMatch(/^<span data-component-key="[^"]+"><\/span>$/);

    const [key] = previewMap.keys();

    expect(previewMap.get(key)).toEqual({ type: 'div', props: { children: 'Hello' } });
  });

  it('should use fromBlock to resolve field props when provided', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'badge',
        label: 'Badge',
        fields: [],
        pattern: /\[badge color="(\w+)"\]/g,
        fromBlock: (match) => ({ color: match[1] }),
        toBlock: ({ color }) => `[badge color="${color}"]`,
        toPreview: ({ color }) => `<span class="badge ${color}"></span>`,
      },
    ];

    const { previewMap } = buildMarkdownWithPreviews('[badge color="red"]', componentDefs);
    const [key] = previewMap.keys();

    expect(previewMap.get(key)).toBe('<span class="badge red"></span>');
  });

  it('should fall back to named groups when fromBlock is not provided', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'tag',
        label: 'Tag',
        fields: [],
        pattern: /\[tag (?<name>\w+)\]/g,
        toBlock: ({ name }) => `[tag ${name}]`,
        toPreview: ({ name }) => `<span class="tag">${name}</span>`,
      },
    ];

    const { previewMap } = buildMarkdownWithPreviews('[tag foo]', componentDefs);
    const [key] = previewMap.keys();

    expect(previewMap.get(key)).toBe('<span class="tag">foo</span>');
  });

  it('should handle multiple instances of the same component', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'note',
        label: 'Note',
        fields: [],
        pattern: /\[note\](?<content>.*?)\[\/note\]/gs,
        toBlock: ({ content }) => `[note]${content}[/note]`,
        toPreview: ({ content }) => `<div>${content}</div>`,
      },
    ];

    const { markdown, previewMap } = buildMarkdownWithPreviews(
      '[note]A[/note] [note]B[/note]',
      componentDefs,
    );

    expect(previewMap.size).toBe(2);
    expect(markdown).toBe('<div>A</div> <div>B</div>');
  });

  it('should encode image src spaces in the markdown', () => {
    const { markdown } = buildMarkdownWithPreviews('![alt](my image.png)', []);

    expect(markdown).toBe('![alt](my%20image.png)');
  });

  it('should assign a suffix key to duplicate component matches', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'hr',
        label: 'HR',
        fields: [],
        // Two identical matches → second gets a `-1` suffix key
        pattern: /\[hr\]/g,
        toBlock: () => '[hr]',
        toPreview: () => '<hr>',
      },
    ];

    const { previewMap } = buildMarkdownWithPreviews('[hr] [hr]', componentDefs);
    const keys = [...previewMap.keys()];

    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(`${keys[0]}-1`);
  });

  it('should fall back to empty object when there is no fromBlock and no named groups', () => {
    let receivedProps;

    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'ping',
        label: 'Ping',
        fields: [],
        // positional groups only — match.groups is undefined
        pattern: /\[ping (\w+)\]/g,
        toBlock: () => '[ping]',
        toPreview: (props) => {
          receivedProps = props;
          return '<span>ping</span>';
        },
      },
    ];

    buildMarkdownWithPreviews('[ping world]', componentDefs);
    expect(receivedProps).toEqual({});
  });

  it('should work with a non-global pattern by promoting it to global', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'note',
        label: 'Note',
        fields: [],
        // no `g` flag intentionally
        pattern: /\[note\](?<content>.*?)\[\/note\]/s,
        toBlock: ({ content }) => `[note]${content}[/note]`,
        toPreview: ({ content }) => `<div class="note">${content}</div>`,
      },
    ];

    const { markdown, previewMap } = buildMarkdownWithPreviews(
      '[note]A[/note] [note]B[/note]',
      componentDefs,
    );

    expect(previewMap.size).toBe(2);
    expect(markdown).toBe('<div class="note">A</div> <div class="note">B</div>');
  });

  it('should reuse the cached global pattern across calls (globalPatternCache)', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'tip',
        label: 'Tip',
        fields: [],
        // Non-global pattern intentionally — exercises the globalPatternCache code path
        pattern: /\[tip\](?<text>.*?)\[\/tip\]/s,
        toBlock: ({ text }) => `[tip]${text}[/tip]`,
        toPreview: ({ text }) => `<aside class="tip">${text}</aside>`,
      },
    ];

    const input = '[tip]First[/tip] and [tip]Second[/tip]';
    // First call — creates and caches the globalised pattern
    const { markdown: md1 } = buildMarkdownWithPreviews(input, componentDefs);
    // Second call — reuses the cached pattern; result must be identical
    const { markdown: md2 } = buildMarkdownWithPreviews(input, componentDefs);

    expect(md1).toBe('<aside class="tip">First</aside> and <aside class="tip">Second</aside>');
    expect(md2).toBe(md1);
  });
});

describe('splitMarkdownBlocks', () => {
  it('should flush last block when input ends without a trailing blank line', () => {
    expect(splitMarkdownBlocks('only one block')).toEqual(['only one block']);
  });

  it('should not add an empty trailing block when input ends with blank lines', () => {
    expect(splitMarkdownBlocks('para one\n\n')).toEqual(['para one']);
  });

  it('should return an empty array for empty string', () => {
    expect(splitMarkdownBlocks('')).toEqual([]);
  });

  it('should return a single block when there are no blank lines', () => {
    expect(splitMarkdownBlocks('Hello **world**')).toEqual(['Hello **world**']);
  });

  it('should split on blank lines', () => {
    expect(splitMarkdownBlocks('para one\n\npara two')).toEqual(['para one', 'para two']);
  });

  it('should split on multiple consecutive blank lines', () => {
    expect(splitMarkdownBlocks('para one\n\n\npara two')).toEqual(['para one', 'para two']);
  });

  it('should keep a fenced code block with an internal blank line intact', () => {
    const md = '```js\nfunction foo() {\n\n  return 1;\n}\n```';

    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it('should split paragraphs around a fenced code block', () => {
    const md = 'intro\n\n```\ncode\n```\n\noutro';

    expect(splitMarkdownBlocks(md)).toEqual(['intro', '```\ncode\n```', 'outro']);
  });

  it('should handle tilde fenced code blocks with internal blank lines', () => {
    const md = '~~~\nline one\n\nline two\n~~~';

    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it('should treat an unclosed fence as extending to end of input', () => {
    const md = '```\nunclosed code\n\nstill in block';

    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it('should handle fences with longer closing markers', () => {
    const md = '````\ncode\n\n````';

    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it('should keep an HTML block element with internal blank lines as one block', () => {
    const md = '<div class="block">\n\ncontent goes here\n\n</div>';

    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it('should keep a nested HTML block element with internal blank lines as one block', () => {
    const md = '<div class="outer">\n\n<div class="inner">\n\nnested\n\n</div>\n\n</div>';

    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it('should split content before and after an HTML block element', () => {
    const md = 'before\n\n<div>\n\ncontent\n\n</div>\n\nafter';

    expect(splitMarkdownBlocks(md)).toEqual(['before', '<div>\n\ncontent\n\n</div>', 'after']);
  });

  it('should not treat a void element as an HTML block', () => {
    expect(splitMarkdownBlocks('<hr>\n\nafter')).toEqual(['<hr>', 'after']);
  });

  it('should not enter HTML block mode when the tag is opened and closed on the same line', () => {
    expect(splitMarkdownBlocks('<div>inline</div>\n\nafter')).toEqual([
      '<div>inline</div>',
      'after',
    ]);
  });

  it('should reuse stored open/close regexes across lines inside an HTML block', () => {
    // A multi-line <div> block that spans three content lines exercises the
    // htmlBlock.openRe / htmlBlock.closeRe reuse path added by the perf optimisation.
    const md = '<div>\nline one\n\nline two\n</div>';

    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it('should correctly parse two HTML blocks using the same tag (exercises tag regex cache)', () => {
    // The second <div> block reuses the cached openRe/closeRe from htmlTagRegexCache rather
    // than constructing fresh RegExp objects.
    const md = '<div>\nfirst block\n</div>\n\n<div>\nsecond block\n</div>';

    expect(splitMarkdownBlocks(md)).toEqual([
      '<div>\nfirst block\n</div>',
      '<div>\nsecond block\n</div>',
    ]);
  });
});

describe('SANITIZE_OPTIONS iframe security (XSS prevention)', () => {
  it('should remove iframes with javascript: scheme', () => {
    // Testing XSS prevention - javascript: URL in test payload

    const malicious = '<iframe src="javascript:alert(1)"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    // eslint-disable-next-line no-script-url
    expect(sanitized).not.toContain('javascript:');
  });

  it('should remove iframes with data: scheme', () => {
    const malicious = '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('data:');
  });

  it('should remove iframes with blob: scheme', () => {
    const malicious = '<iframe src="blob:http://example.com/uuid"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('blob:');
  });

  it('should remove iframes with file: scheme', () => {
    const malicious = '<iframe src="file:///etc/passwd"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('file:');
  });

  it('should remove iframes with vbscript: scheme', () => {
    const malicious = '<iframe src="vbscript:msgbox(1)"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('vbscript:');
  });

  it('should remove iframes with same-origin relative paths (leading slash)', () => {
    const malicious = '<iframe src="/uploads/malicious.html"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('/uploads/');
  });

  it('should remove iframes with same-origin relative paths (double slash)', () => {
    const malicious = '<iframe src="//example.com/malicious.html"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes with relative paths (dot notation)', () => {
    const malicious = '<iframe src="./malicious.html"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes with relative paths (parent directory)', () => {
    const malicious = '<iframe src="../uploads/malicious.html"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes without src attribute', () => {
    const malicious = '<iframe></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes with empty src attribute', () => {
    const malicious = '<iframe src=""></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should remove iframes with whitespace-only src attribute', () => {
    const malicious = '<iframe src="   "></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should block same-origin HTTPS iframes', () => {
    // Mock window.location.origin to match the iframe src origin
    vi.stubGlobal('window', {
      location: { origin: 'https://example.com' },
    });

    try {
      const sameOrigin = '<iframe src="https://example.com/malicious.html"></iframe>';
      const sanitized = sanitizeRichTextHTML(sameOrigin);

      expect(sanitized).not.toContain('iframe');
    } finally {
      // Restore original window
      vi.unstubAllGlobals();
    }
  });

  it('should remove iframes with about:blank', () => {
    const malicious = '<iframe src="about:blank"></iframe>';
    const sanitized = sanitizeRichTextHTML(malicious);

    expect(sanitized).not.toContain('iframe');
  });

  it('should enforce sandbox="allow-scripts allow-same-origin" on valid HTTPS iframes', () => {
    const embed = '<iframe src="https://www.youtube.com/embed/video123"></iframe>';
    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });

  it('should ensure both allow-scripts and allow-same-origin in sandbox', () => {
    const embed =
      '<iframe src="https://player.vimeo.com/video/123" sandbox="allow-same-origin allow-scripts"></iframe>';

    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });

  it('should add allow-scripts and allow-same-origin to custom sandbox attributes', () => {
    const embed = '<iframe src="https://example.com/embed" sandbox="allow-popups"></iframe>';
    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
    expect(sanitized).toContain('allow-popups');
  });

  it('should preserve allow and allowfullscreen attributes', () => {
    const embed =
      '<iframe src="https://www.youtube.com/embed/video" allow="autoplay; encrypted-media" allowfullscreen></iframe>';

    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('allow="autoplay; encrypted-media"');
    expect(sanitized).toContain('allowfullscreen');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });

  it('should preserve referrerpolicy attribute', () => {
    const embed =
      '<iframe src="https://www.youtube.com/embed/video" referrerpolicy="strict-origin-when-cross-origin"></iframe>';

    const sanitized = sanitizeRichTextHTML(embed);

    expect(sanitized).toContain('iframe');
    expect(sanitized).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });

  it('should allow HTTPS iframes from trusted external providers', () => {
    const youtubeEmbed = '<iframe src="https://www.youtube.com/embed/abc"></iframe>';
    const vimeoEmbed = '<iframe src="https://player.vimeo.com/video/123"></iframe>';
    const externalEmbed = '<iframe src="https://example.com/embed/content"></iframe>';

    expect(sanitizeRichTextHTML(youtubeEmbed)).toContain('iframe');
    expect(sanitizeRichTextHTML(vimeoEmbed)).toContain('iframe');
    expect(sanitizeRichTextHTML(externalEmbed)).toContain('iframe');
  });

  it('should block HTTP iframes', () => {
    const httpEmbed = '<iframe src="http://example.com/embed"></iframe>';
    const sanitized = sanitizeRichTextHTML(httpEmbed);

    expect(sanitized).not.toContain('iframe');
  });

  it('should block multiple XSS vectors in a single document', () => {
    const multipleThreats = `
      <iframe src="javascript:alert('xss1')"></iframe>
      <iframe src="/uploads/malicious.html"></iframe>
      <iframe src="data:text/html,<script>alert('xss2')</script>"></iframe>
      <iframe src="blob:http://evil.com/uuid"></iframe>
      <iframe src="https://www.youtube.com/embed/safe"></iframe>
    `;

    const sanitized = sanitizeRichTextHTML(multipleThreats);
    // Should only contain the safe HTTPS iframe
    const iframeMatches = sanitized.match(/<iframe/g);

    expect(iframeMatches).toHaveLength(1);
    expect(sanitized).toContain('https://www.youtube.com/embed/safe');
    // eslint-disable-next-line no-script-url
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('/uploads/');
    expect(sanitized).not.toContain('data:');
    expect(sanitized).not.toContain('blob:');
  });

  it('should handle case-insensitive scheme matching', () => {
    // Testing XSS prevention with various capitalizations

    const schemes = [
      '<iframe src="JavaScript:alert(1)"></iframe>',
      '<iframe src="JAVASCRIPT:alert(1)"></iframe>',
      '<iframe src="JaVaScRiPt:alert(1)"></iframe>',
      '<iframe src="DATA:text/html,xss"></iframe>',
      '<iframe src="BloB:http://evil.com/x"></iframe>',
    ];

    schemes.forEach((html) => {
      const sanitized = sanitizeRichTextHTML(html);

      expect(sanitized).not.toContain('iframe');
    });
  });

  it('should block iframes with obfuscated same-origin paths', () => {
    const obfuscated = [
      '<iframe src="  /uploads/file.html"></iframe>',
      '<iframe src="\\uploads\\file.html"></iframe>',
      '<iframe src="//localhost/file.html"></iframe>',
    ];

    obfuscated.forEach((html) => {
      const sanitized = sanitizeRichTextHTML(html);

      expect(sanitized).not.toContain('iframe');
    });
  });

  it('should handle iframes with invalid URLs', () => {
    const invalid = [
      '<iframe src="not a url at all"></iframe>',
      '<iframe src="ht!tp://broken.com"></iframe>',
      '<iframe src="://no-protocol.com"></iframe>',
    ];

    invalid.forEach((html) => {
      const sanitized = sanitizeRichTextHTML(html);

      expect(sanitized).not.toContain('iframe');
    });
  });

  it('should block malformed HTTPS URLs that throw in URL constructor', () => {
    const malformed = [
      '<iframe src="https://"></iframe>', // Missing host
      '<iframe src="https:// bad spaces"></iframe>', // Spaces in URL
      '<iframe src="https://[invalid:ipv6"></iframe>', // Malformed IPv6
    ];

    malformed.forEach((html) => {
      const sanitized = sanitizeRichTextHTML(html);

      expect(sanitized).not.toContain('iframe');
    });
  });

  it('should normalize sandbox attributes when multiple are present', () => {
    const bypassAttempt =
      '<iframe src="https://example.com" sandbox="allow-scripts allow-same-origin" sandbox=""></iframe>';

    const sanitized = sanitizeRichTextHTML(bypassAttempt);

    expect(sanitized).toContain('allow-scripts');
    expect(sanitized).toContain('allow-same-origin');
  });
});
