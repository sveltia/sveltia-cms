// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import {
  getFencedCodeLanguages,
  keyBlocks,
  splitHTMLBlocks,
  splitMarkdownBlocks,
} from './blocks.js';

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

describe('keyBlocks', () => {
  it('should key blocks by content and occurrence', () => {
    const { list, items } = keyBlocks(['a', 'b', 'a'], new Map());

    expect(list).toEqual([
      { key: '0\na', block: 'a' },
      { key: '0\nb', block: 'b' },
      { key: '1\na', block: 'a' },
    ]);
    expect([...items.keys()]).toEqual(['0\na', '0\nb', '1\na']);
  });

  it('should reuse the item of an unchanged block', () => {
    const { list: first, items } = keyBlocks(['a', 'b'], new Map());
    const { list: second, items: nextItems } = keyBlocks(['c', 'b'], items);

    expect(second[1]).toBe(first[1]);
    expect(second[0]).toEqual({ key: '0\nc', block: 'c' });
    expect(nextItems.has('0\na')).toBe(false);
  });
});

describe('getFencedCodeLanguages', () => {
  it('should list the unique languages of fenced code blocks, sorted', () => {
    expect(
      getFencedCodeLanguages(
        '```js\na\n```\n\n   ```css\nb\n```\n\n```js\nc\n```\n\n    ```html\nindented\n```\n\n```\nnone\n```',
      ),
    ).toEqual(['css', 'js']);
  });

  it('should return an empty list without code blocks', () => {
    expect(getFencedCodeLanguages('text')).toEqual([]);
  });
});
