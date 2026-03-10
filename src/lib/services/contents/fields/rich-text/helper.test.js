/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, it } from 'vitest';

import {
  buildMarkdownWithPreviews,
  encodeImageSrc,
  inlineStringPreviews,
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

  it('should replace a matched component with a placeholder span', () => {
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
    expect(markdown).toMatch(/^<span data-component-key="[^"]+"><\/span>$/);

    const [key] = previewMap.keys();

    expect(previewMap.get(key)).toBe('<div class="note">Hello</div>');
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
    expect(markdown).toMatch(
      /^<span data-component-key="[^"]+"><\/span> <span data-component-key="[^"]+"><\/span>$/,
    );
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
    expect(markdown).toMatch(
      /^<span data-component-key="[^"]+"><\/span> <span data-component-key="[^"]+"><\/span>$/,
    );
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
});

describe('inlineStringPreviews', () => {
  it('should replace a placeholder with a string preview', () => {
    const previewMap = new Map([['key-1', '<div>preview</div>']]);
    const html = '<p><span data-component-key="key-1"></span></p>';

    expect(inlineStringPreviews(html, previewMap)).toBe('<p><div>preview</div></p>');
  });

  it('should leave the placeholder intact when the preview is not a string', () => {
    // Simulate a React element (non-string value)
    /** @type {Map<string, any>} */
    const previewMap = new Map([['key-1', { type: 'div', props: {} }]]);
    const html = '<p><span data-component-key="key-1"></span></p>';

    expect(inlineStringPreviews(html, previewMap)).toBe(html);
  });

  it('should leave the placeholder intact when the key is not in the map', () => {
    const previewMap = new Map();
    const html = '<p><span data-component-key="missing-key"></span></p>';

    expect(inlineStringPreviews(html, previewMap)).toBe(html);
  });

  it('should replace multiple placeholders in one pass', () => {
    const previewMap = new Map([
      ['key-1', '<b>one</b>'],
      ['key-2', '<i>two</i>'],
    ]);

    const html =
      '<p><span data-component-key="key-1"></span></p>' +
      '<p><span data-component-key="key-2"></span></p>';

    expect(inlineStringPreviews(html, previewMap)).toBe('<p><b>one</b></p><p><i>two</i></p>');
  });

  it('should handle html with no placeholders', () => {
    const previewMap = new Map([['key-1', '<b>one</b>']]);
    const html = '<p>No components here</p>';

    expect(inlineStringPreviews(html, previewMap)).toBe(html);
  });
});
