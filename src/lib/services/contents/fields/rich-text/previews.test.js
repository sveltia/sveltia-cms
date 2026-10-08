// @vitest-environment happy-dom
/* eslint-disable jsdoc/require-jsdoc */

import { fromJS, isList } from 'immutable';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildMarkdownWithPreviews,
  encodeImageSrc,
  getComponentFieldList,
  getNoAsset,
  MEDIA_QUERY_SELECTOR,
  parseSrcset,
  resolveMediaURLs,
  splitHTMLBlocks,
  splitMarkdownBlocks,
} from './previews.js';

const { immutableLoaded } = vi.hoisted(() => ({
  immutableLoaded: { current: false },
}));

vi.mock('$lib/services/api/immutable', () => ({
  getImmutable: () => ({ fromJS }),
  immutableLoaded,
}));

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

describe('splitHTMLBlocks', () => {
  it('should split HTML into its top-level nodes, keeping the text between them', () => {
    expect(
      splitHTMLBlocks(
        '<h2>Title</h2>\n<p>A <b>bold</b> move</p><!-- more -->Tom &amp; <i>Jerry</i>',
      ),
    ).toEqual(['<h2>Title</h2>', '\n', '<p>A <b>bold</b> move</p>', 'Tom &amp; ', '<i>Jerry</i>']);
  });

  it('should keep a component placeholder as a block', () => {
    expect(splitHTMLBlocks('<p>Hi</p><span data-component-key="abc"></span>')).toEqual([
      '<p>Hi</p>',
      '<span data-component-key="abc"></span>',
    ]);
  });

  it('should return no blocks for an empty string', () => {
    expect(splitHTMLBlocks('')).toEqual([]);
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

  describe('with the HTML format', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'note',
        label: 'Note',
        fields: [],
        pattern: /\[note\](?<content>.*?)\[\/note\]/s,
        toBlock: ({ content }) => `[note]${content}[/note]`,
        toPreview: ({ content }) => `<div class="preview">${content}</div>`,
        htmlSelector: 'aside',
        fromBlockHTML: (element) =>
          element.classList.contains('note') ? { content: element.innerHTML } : undefined,
        toBlockHTML: ({ content }) => `<aside class="note">${content}</aside>`,
      },
      {
        // A component without HTML support is left out
        id: 'markdown-only',
        label: 'Markdown Only',
        fields: [],
        pattern: /<p>/,
        toBlock: () => '',
        toPreview: () => '<b>should not be used</b>',
      },
    ];

    /**
     * Build the preview of an HTML value.
     * @param {string | undefined} html HTML.
     * @param {import('$lib/types/public').EditorComponentDefinition[]} [defs] Definitions.
     * @param {Map<string, any>} [previousPreviewMap] Previous preview map.
     * @returns {ReturnType<typeof buildMarkdownWithPreviews>} Result.
     */
    const build = (html, defs = componentDefs, previousPreviewMap = undefined) =>
      buildMarkdownWithPreviews(html, defs, previousPreviewMap, undefined, 'html');

    it('should find the components with the HTML syntax, outermost first', () => {
      const { markdown, previewMap } = build(
        '<p>[note]Not a note[/note]</p><section><aside class="note">Hi <aside class="note">' +
          'nested</aside></aside></section><aside>Not a note either</aside>',
      );

      expect(markdown).toBe(
        '<p>[note]Not a note[/note]</p><section><div class="preview">Hi <aside class="note">' +
          'nested</aside></div></section><aside>Not a note either</aside>',
      );
      expect(previewMap.size).toBe(1);
    });

    it('should replace an element preview with a placeholder, with unique keys', () => {
      const element = document.createElement('div');
      const defs = [{ ...componentDefs[0], toPreview: () => element }];

      const { markdown, previewMap } = build(
        '<aside class="note">Hi</aside><aside class="note">Hi</aside>',
        defs,
      );

      const keys = [...previewMap.keys()];

      expect(keys).toHaveLength(2);
      expect(keys[1]).toBe(`${keys[0]}-1`);
      expect(markdown).toBe(
        keys.map((key) => `<span data-component-key="${key}"></span>`).join(''),
      );
      expect([...previewMap.values()]).toEqual([element, element]);
    });

    it('should reuse a preview from the previous run', () => {
      const toPreview = vi.fn(() => '<b>preview</b>');
      const defs = [{ ...componentDefs[0], toPreview }];
      const { previewMap } = build('<aside class="note">Hi</aside>', defs);
      const { markdown } = build('<p>New</p><aside class="note">Hi</aside>', defs, previewMap);

      expect(toPreview).toHaveBeenCalledOnce();
      expect(markdown).toBe('<p>New</p><b>preview</b>');
    });

    it('should leave the HTML of a component without a preview as is', () => {
      const html = '<p><aside class="note">Hi</aside></p>';
      const { markdown, previewMap } = build(html, [{ ...componentDefs[0], toPreview: undefined }]);

      expect(markdown).toBe(html);
      expect(previewMap.size).toBe(0);
    });

    it('should return an empty string for an undefined value', () => {
      expect(build(undefined).markdown).toBe('');
    });
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

  it('should replace an HTML element preview with a placeholder span', () => {
    // Simulate an element with a Svelte component mounted on it
    const element = /** @type {HTMLElement} */ (
      /** @type {unknown} */ ({ nodeType: 1, localName: 'aside' })
    );

    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'warning',
        label: 'Warning',
        fields: [],
        pattern: /\[warning\](?<content>.*?)\[\/warning\]/gs,
        toBlock: ({ content }) => `[warning]${content}[/warning]`,
        toPreview: () => element,
      },
    ];

    const { markdown, previewMap } = buildMarkdownWithPreviews(
      '[warning]Hello[/warning]',
      componentDefs,
    );

    expect(markdown).toMatch(/^<span data-component-key="[^"]+"><\/span>$/);

    const [key] = previewMap.keys();

    expect(previewMap.get(key)).toBe(element);
  });

  it('should reuse a preview from the previous map when the component is unchanged', () => {
    // Simulate an element with a Svelte component mounted on it
    const toPreview = vi.fn(
      ({ content }) =>
        /** @type {HTMLElement} */ (
          /** @type {unknown} */ ({ nodeType: 1, localName: 'aside', content })
        ),
    );

    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'warning',
        label: 'Warning',
        fields: [],
        pattern: /\[warning\](?<content>.*?)\[\/warning\]/gs,
        toBlock: ({ content }) => `[warning]${content}[/warning]`,
        toPreview,
      },
    ];

    const { previewMap: firstMap } = buildMarkdownWithPreviews(
      '[warning]Hello[/warning]',
      componentDefs,
    );

    expect(toPreview).toHaveBeenCalledTimes(1);

    // The component is unchanged, so the same preview object must be kept
    const { previewMap: secondMap } = buildMarkdownWithPreviews(
      '[warning]Hello[/warning]\n\nMore text',
      componentDefs,
      firstMap,
    );

    const [key] = secondMap.keys();

    expect(toPreview).toHaveBeenCalledTimes(1);
    expect(secondMap.get(key)).toBe(firstMap.get(key));

    // The component has changed, so a new preview must be computed
    const { previewMap: thirdMap } = buildMarkdownWithPreviews(
      '[warning]Bye[/warning]',
      componentDefs,
      secondMap,
    );

    const [newKey] = thirdMap.keys();

    expect(toPreview).toHaveBeenCalledTimes(2);
    expect(thirdMap.get(newKey)).not.toBe(firstMap.get(key));
  });

  it('should compute a preview again when the previous map has no value for the key', () => {
    const toPreview = vi.fn(() => '<hr>');

    /** @type {import('$lib/types/public').EditorComponentDefinition[]} */
    const componentDefs = [
      {
        id: 'hr',
        label: 'HR',
        fields: [],
        pattern: /\[hr\]/g,
        toBlock: () => '[hr]',
        toPreview,
      },
    ];

    const { markdown } = buildMarkdownWithPreviews('[hr]', componentDefs, new Map());

    expect(toPreview).toHaveBeenCalledTimes(1);
    expect(markdown).toBe('<hr>');
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

  describe('nested components', () => {
    const nested = '<A>\n\nouter\n\n<B>\n\ninner\n\n</B>\n\n</A>';

    /**
     * Create a definition with an element preview that records the props it receives.
     * @param {string} name Tag name.
     * @returns {import('$lib/types/public').EditorComponentDefinition & { toPreview: any }} Def.
     */
    const elementDef = (name) => ({
      id: name,
      label: name,
      fields: [{ name: 'body', widget: 'richtext' }],
      pattern: new RegExp(`<${name}>\\s*(?<body>[\\s\\S]*?)\\s*<\\/${name}>`),
      toBlock: ({ body }) => `<${name}>${body}</${name}>`,
      toPreview: vi.fn(
        () =>
          /** @type {HTMLElement} */ (/** @type {unknown} */ ({ nodeType: 1, localName: name })),
      ),
    });

    it('should pass the raw nested content to the outer component (outer registered first)', () => {
      const A = elementDef('A');
      const B = elementDef('B');
      const { markdown, previewMap } = buildMarkdownWithPreviews(nested, [A, B]);

      expect(A.toPreview).toHaveBeenCalledWith(
        { body: 'outer\n\n<B>\n\ninner\n\n</B>' },
        expect.any(Function),
        undefined,
      );
      expect(B.toPreview).not.toHaveBeenCalled();
      expect(previewMap.size).toBe(1);
      expect(markdown).toMatch(/^<span data-component-key="[^"]+"><\/span>$/);
    });

    it('should pass the raw nested content to the outer component (inner registered first)', () => {
      const A = elementDef('A');
      const B = elementDef('B');
      const { markdown, previewMap } = buildMarkdownWithPreviews(nested, [B, A]);

      expect(A.toPreview).toHaveBeenCalledWith(
        { body: 'outer\n\n<B>\n\ninner\n\n</B>' },
        expect.any(Function),
        undefined,
      );
      expect(B.toPreview).not.toHaveBeenCalled();
      expect(previewMap.size).toBe(1);
      expect(markdown).toMatch(/^<span data-component-key="[^"]+"><\/span>$/);
    });

    it('should substitute a component exposed by a string preview regardless of order', () => {
      /** @type {import('$lib/types/public').EditorComponentDefinition} */
      const A = {
        ...elementDef('A'),
        toPreview: ({ body }) => `<div class="a">${body}</div>`,
      };

      const B = elementDef('B');
      const expected = /^<div class="a">outer\n\n<span data-component-key="[^"]+"><\/span><\/div>$/;
      const first = buildMarkdownWithPreviews(nested, [A, B]);

      expect(first.markdown).toMatch(expected);
      expect(first.previewMap.size).toBe(2);
      expect(B.toPreview).toHaveBeenCalledWith({ body: 'inner' }, expect.any(Function), undefined);

      const second = buildMarkdownWithPreviews(nested, [B, A]);

      expect(second.markdown).toMatch(expected);
      expect(second.previewMap.size).toBe(2);
    });

    it('should reuse nested previews from the previous map across passes', () => {
      /** @type {import('$lib/types/public').EditorComponentDefinition} */
      const A = {
        ...elementDef('A'),
        toPreview: ({ body }) => `<div class="a">${body}</div>`,
      };

      const B = elementDef('B');
      const { previewMap } = buildMarkdownWithPreviews(nested, [A, B]);
      const { previewMap: secondMap } = buildMarkdownWithPreviews(nested, [A, B], previewMap);
      const [, keyB] = previewMap.keys();

      expect(B.toPreview).toHaveBeenCalledTimes(1);
      expect(secondMap.get(keyB)).toBe(previewMap.get(keyB));
    });

    it('should prefer the longest match when two patterns start at the same index', () => {
      const short = elementDef('A');

      /** @type {import('$lib/types/public').EditorComponentDefinition} */
      const long = {
        ...elementDef('A'),
        id: 'long',
        pattern: /<A>[\s\S]*<\/A> tail/,
      };

      const input = '<A>x</A> tail';
      const { markdown } = buildMarkdownWithPreviews(input, [short, long]);

      expect(long.toPreview).toHaveBeenCalledTimes(1);
      expect(short.toPreview).not.toHaveBeenCalled();
      expect(markdown).toMatch(/^<span data-component-key="[^"]+"><\/span>$/);
    });

    it('should prefer the earliest definition when two patterns match the same range', () => {
      const first = elementDef('A');
      const second = { ...elementDef('A'), id: 'second' };
      const { previewMap } = buildMarkdownWithPreviews('<A>x</A>', [first, second]);

      expect(first.toPreview).toHaveBeenCalledTimes(1);
      expect(second.toPreview).not.toHaveBeenCalled();
      expect(previewMap.size).toBe(1);
    });

    it('should ignore zero-length matches', () => {
      /** @type {import('$lib/types/public').EditorComponentDefinition} */
      const def = {
        id: 'empty',
        label: 'Empty',
        fields: [],
        pattern: /x*/g,
        toBlock: () => '',
        toPreview: vi.fn(() => '<hr>'),
      };

      const { markdown, previewMap } = buildMarkdownWithPreviews('abc', [def]);

      expect(markdown).toBe('abc');
      expect(previewMap.size).toBe(0);
      expect(def.toPreview).not.toHaveBeenCalled();
    });

    it('should not substitute a preview that reproduces its own syntax', () => {
      // A component with HTML syntax, whose preview mirrors `toBlock()` and matches the pattern
      /** @type {import('$lib/types/public').EditorComponentDefinition} */
      const def = {
        id: 'note',
        label: 'Note',
        fields: [
          { name: 'summary', widget: 'string' },
          { name: 'content', widget: 'richtext' },
        ],
        pattern:
          /^<details>\s*<summary>(?<summary>.+?)<\/summary>\s*(?<content>[\s\S]+?)\s*<\/details>/m,
        toBlock: ({ summary, content }) =>
          `<details>\n<summary>${summary}</summary>\n${content}\n</details>`,
        toPreview: vi.fn(
          ({ summary, content }) =>
            `<details>\n<summary>${summary}</summary>\n<p>${content}</p>\n</details>`,
        ),
      };

      const input = '<details>\n<summary>Sum</summary>\nFirst line\n</details>';
      const { markdown, previewMap } = buildMarkdownWithPreviews(input, [def]);

      expect(def.toPreview).toHaveBeenCalledTimes(1);
      expect(previewMap.size).toBe(1);
      expect(markdown).toBe('<details>\n<summary>Sum</summary>\n<p>First line</p>\n</details>');
    });

    it('should not substitute a preview that wraps its own syntax in other markup', () => {
      /** @type {import('$lib/types/public').EditorComponentDefinition} */
      const def = {
        id: 'loop',
        label: 'Loop',
        fields: [],
        pattern: /\[loop\]/,
        toBlock: () => '[loop]',
        // The preview contains the component syntax again, but it doesn’t come from a field value
        toPreview: vi.fn(() => '<b>[loop]</b>'),
      };

      const { markdown, previewMap } = buildMarkdownWithPreviews('[loop]', [def]);

      expect(def.toPreview).toHaveBeenCalledTimes(1);
      expect(previewMap.size).toBe(1);
      expect(markdown).toBe('<b>[loop]</b>');
    });

    it('should substitute a component that a preview exposes through a nested value', () => {
      /** @type {import('$lib/types/public').EditorComponentDefinition} */
      const A = {
        ...elementDef('A'),
        // The preview mirrors the syntax itself, but the nested component is still substituted
        toPreview: ({ body }) => `<A>${body}</A>`,
      };

      const B = elementDef('B');
      const { markdown, previewMap } = buildMarkdownWithPreviews(nested, [A, B]);

      expect(markdown).toMatch(/^<A>outer\n\n<span data-component-key="[^"]+"><\/span><\/A>$/);
      expect(previewMap.size).toBe(2);
      expect(B.toPreview).toHaveBeenCalledWith({ body: 'inner' }, expect.any(Function), undefined);
    });

    it('should substitute a component that a preview exposes through a list item', () => {
      /** @type {import('$lib/types/public').EditorComponentDefinition} */
      const A = {
        ...elementDef('A'),
        fields: [{ name: 'items', widget: 'list', field: { name: 'body', widget: 'richtext' } }],
        // Values that aren’t strings, like the count and the missing title, are simply skipped
        fromBlock: ({ groups }) => ({
          count: 1,
          title: undefined,
          items: [{ body: groups?.body }],
        }),
        toPreview: ({ items }) =>
          items.map((/** @type {{ body: string }} */ { body }) => `<li>${body}</li>`).join(''),
      };

      const B = elementDef('B');
      const { markdown } = buildMarkdownWithPreviews(nested, [A, B]);

      expect(markdown).toMatch(/^<li>outer\n\n<span data-component-key="[^"]+"><\/span><\/li>$/);
      expect(B.toPreview).toHaveBeenCalledWith({ body: 'inner' }, expect.any(Function), undefined);
    });

    it('should stop after a bounded number of passes when a value reproduces its syntax', () => {
      /** @type {import('$lib/types/public').EditorComponentDefinition} */
      const def = {
        id: 'loop',
        label: 'Loop',
        fields: [{ name: 'body', widget: 'richtext' }],
        pattern: /\[loop\]/,
        toBlock: () => '[loop]',
        // The value carries the component syntax into the preview, which would otherwise never
        // settle
        fromBlock: () => ({ body: '[loop]' }),
        toPreview: vi.fn(({ body }) => `<b>${body}</b>`),
      };

      const { markdown, previewMap } = buildMarkdownWithPreviews('[loop]', [def]);

      expect(def.toPreview).toHaveBeenCalledTimes(10);
      expect(previewMap.size).toBe(10);
      expect(markdown).toBe(`${'<b>'.repeat(10)}[loop]${'</b>'.repeat(10)}`);
    });
  });
});

describe('toPreview arguments', () => {
  /**
   * Create a definition whose preview records the arguments it receives.
   * @returns {import('$lib/types/public').EditorComponentDefinition & { toPreview: any }} Def.
   */
  const imageDef = () => ({
    id: 'figure',
    label: 'Figure',
    fields: [{ name: 'src', widget: 'image' }],
    pattern: /^:::figure (?<src>.+)$/m,
    toBlock: ({ src }) => `:::figure ${src}`,
    toPreview: vi.fn((/** @type {any} */ { src }, /** @type {any} */ getAsset) => {
      const asset = getAsset(src);

      return `<img src="${asset ?? ''}" alt="">`;
    }),
  });

  afterEach(() => {
    immutableLoaded.current = false;
  });

  it('should never find an asset without a getter', () => {
    expect(getNoAsset('photo.jpg')).toBeUndefined();

    const { markdown } = buildMarkdownWithPreviews(':::figure photo.jpg', [imageDef()]);

    expect(markdown).toBe('<img src="" alt="">');
  });

  it('should pass the given asset getter', () => {
    const getAsset = vi.fn(() => /** @type {any} */ ({ toString: () => 'blob:photo' }));
    const def = imageDef();

    const { markdown, previewMap, assetMap } = buildMarkdownWithPreviews(
      ':::figure photo.jpg\n\n:::figure none.jpg',
      [def],
      undefined,
      (path) => (path === 'photo.jpg' ? getAsset() : undefined),
    );

    expect(getAsset).toHaveBeenCalledOnce();
    expect(def.toPreview).toHaveBeenCalledWith(
      { src: 'photo.jpg' },
      expect.any(Function),
      undefined,
    );

    // The assets each preview has got are reported, so the preview can be computed again once
    // their URL changes, but only for the previews computed in this run
    const [photoKey] = previewMap.keys();

    expect([...assetMap.keys()]).toEqual([photoKey]);
    expect(assetMap.get(photoKey)).toEqual([getAsset.mock.results[0].value]);
    expect(buildMarkdownWithPreviews(':::figure photo.jpg', [def], previewMap).assetMap.size).toBe(
      0,
    );
    expect(markdown).toBe('<img src="blob:photo" alt="">\n\n<img src="" alt="">');
  });

  it('should pass the fields as an Immutable List once Immutable.js is loaded', () => {
    const def = imageDef();

    expect(getComponentFieldList(def)).toBeUndefined();

    immutableLoaded.current = true;

    const fields = getComponentFieldList(def);

    expect(isList(fields)).toBe(true);
    expect(fields?.toJS()).toEqual(def.fields);
    // The list is created once per component
    expect(getComponentFieldList(def)).toBe(fields);

    buildMarkdownWithPreviews(':::figure photo.jpg', [def]);

    expect(def.toPreview).toHaveBeenCalledWith({ src: 'photo.jpg' }, expect.any(Function), fields);
    expect(
      def.toPreview.mock.calls[0][2].find((/** @type {any} */ f) => f.get('widget') === 'image'),
    ).toBeDefined();
  });
});

describe('MEDIA_QUERY_SELECTOR', () => {
  it('should match the URL attributes of images, videos and audio not processed yet', () => {
    expect(MEDIA_QUERY_SELECTOR).toBe(
      ':is(img[src], img[srcset], source[src], source[srcset], video[src], video[poster], ' +
        'audio[src]):not([data-processed])',
    );
  });
});

describe('parseSrcset', () => {
  it('should parse URLs with and without descriptors', () => {
    expect(parseSrcset('a.jpg 1x, b.jpg 2x')).toEqual([
      { url: 'a.jpg', descriptor: '1x' },
      { url: 'b.jpg', descriptor: '2x' },
    ]);
    expect(parseSrcset('  a.jpg,, b.jpg   800w ,  ')).toEqual([
      { url: 'a.jpg', descriptor: '' },
      { url: 'b.jpg', descriptor: '800w' },
    ]);
    expect(parseSrcset('a.jpg')).toEqual([{ url: 'a.jpg', descriptor: '' }]);
    expect(parseSrcset(' , ')).toEqual([]);
  });

  it('should keep a comma within a URL', () => {
    expect(parseSrcset('data:image/png;base64,AAAA 1x, /b.png 2x')).toEqual([
      { url: 'data:image/png;base64,AAAA', descriptor: '1x' },
      { url: '/b.png', descriptor: '2x' },
    ]);
  });
});

describe('resolveMediaURLs', () => {
  /**
   * Create a minimal element.
   * @param {string} localName Tag name.
   * @param {Record<string, string>} attributes Attributes.
   * @param {any} [parentElement] Parent element.
   * @returns {any} Element.
   */
  const createElement = (localName, attributes, parentElement = null) => ({
    localName,
    parentElement,
    attributes: { ...attributes },
    getAttribute(/** @type {string} */ name) {
      return this.attributes[name] ?? null;
    },
    setAttribute(/** @type {string} */ name, /** @type {string} */ value) {
      this.attributes[name] = value;
    },
  });

  /**
   * Resolve a path to a blob URL, unless it’s missing.
   * @param {string} value Path.
   * @returns {Promise<string | undefined>} URL.
   */
  const resolve = async (value) => (value.includes('missing') ? undefined : `blob:${value}`);

  it('should resolve the URL attributes of a media element', async () => {
    const video = createElement('video', { src: '/clip.mp4', poster: '/poster.jpg', id: 'x' });

    await resolveMediaURLs(video, resolve);

    expect(video.attributes).toEqual({
      src: 'blob:/clip.mp4',
      poster: 'blob:/poster.jpg',
      id: 'x',
    });
  });

  it('should resolve each URL in a srcset, and leave what can’t be resolved', async () => {
    const img = createElement('img', {
      src: '/missing.jpg',
      srcset: '/a.jpg 1x, /missing.jpg 2x',
    });

    await resolveMediaURLs(img, resolve);

    expect(img.attributes).toEqual({
      src: '/missing.jpg',
      srcset: 'blob:/a.jpg 1x, /missing.jpg 2x',
    });

    // A srcset without a resolved URL is left as written
    const unchanged = createElement('img', { srcset: '/missing.jpg 1x,/missing.jpg 2x' });

    unchanged.setAttribute = vi.fn();
    await resolveMediaURLs(unchanged, resolve);
    expect(unchanged.setAttribute).not.toHaveBeenCalled();
  });

  it('should load the media again once a source is updated', async () => {
    const video = { localName: 'video', load: vi.fn() };
    const source = createElement('source', { src: '/clip.mp4' }, video);

    await resolveMediaURLs(source, resolve);
    expect(source.attributes.src).toBe('blob:/clip.mp4');
    expect(video.load).toHaveBeenCalledOnce();

    // Nothing to load again if the source is unchanged, or within a picture
    await resolveMediaURLs(createElement('source', { src: '/missing.mp4' }, video), resolve);
    expect(video.load).toHaveBeenCalledOnce();

    const picture = { localName: 'picture', load: vi.fn() };

    await resolveMediaURLs(createElement('source', { srcset: '/a.jpg' }, picture), resolve);
    await resolveMediaURLs(createElement('source', { srcset: '/a.jpg' }), resolve);
    expect(picture.load).not.toHaveBeenCalled();
  });

  it('should leave a URL that fails to be resolved, and resolve the others', async () => {
    const img = createElement('img', {
      src: '/broken.jpg',
      srcset: '/broken.jpg 1x, /a.jpg 2x',
    });

    await resolveMediaURLs(img, async (value) => {
      if (value === '/broken.jpg') {
        throw new Error('Failed to retrieve blob');
      }

      return `blob:${value}`;
    });

    expect(img.attributes).toEqual({
      src: '/broken.jpg',
      srcset: '/broken.jpg 1x, blob:/a.jpg 2x',
    });
  });

  it('should ignore an element without URL attributes', async () => {
    const audio = createElement('audio', {});
    const other = createElement('div', { src: '/a.jpg' });

    await resolveMediaURLs(audio, resolve);
    await resolveMediaURLs(other, resolve);
    expect(audio.attributes).toEqual({});
    expect(other.attributes).toEqual({ src: '/a.jpg' });
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
