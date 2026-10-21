// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import {
  addLinkDefinitions,
  getFencedCodeLanguages,
  getLinkDefinitions,
  keyBlocks,
  splitHTMLBlocks,
  splitMarkdownBlocks,
  splitPreviewBlocks,
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

  it('should close a fence with a longer run of the fence character', () => {
    const md = '```\ncode\n\n````\n\nnext';

    expect(splitMarkdownBlocks(md)).toEqual(['```\ncode\n\n````', 'next']);
  });

  it('should not take a code span for a fence, as a backtick fence’s info can’t have a backtick', () => {
    const md = '```inline``` code\n\npara two\n\npara three';

    expect(splitMarkdownBlocks(md)).toEqual(['```inline``` code', 'para two', 'para three']);
  });

  it('should allow a backtick in the info string of a tilde fence', () => {
    const md = '~~~ js `title`\ncode\n\nmore code\n~~~';

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

  it('should keep an HTML comment with internal blank lines as one block', () => {
    expect(splitMarkdownBlocks('A\n\n<!-- one\n\ntwo -->\nB\n\nC')).toEqual([
      'A',
      '<!-- one\n\ntwo -->\nB',
      'C',
    ]);
    expect(splitMarkdownBlocks('<!-- one -->\n\nA')).toEqual(['<!-- one -->', 'A']);
    // An unclosed comment runs to the end
    expect(splitMarkdownBlocks('  <!--\n\nA')).toEqual(['  <!--\n\nA']);
  });

  it('should keep other raw HTML blocks with internal blank lines as one block', () => {
    [
      '<script>\na();\n\nb();\n</script>',
      '<PRE\n\n</pre>',
      '<?php\n\necho 1; ?>',
      '<!DOCTYPE\n\nhtml>',
      '<![CDATA[\n\n]]>',
    ].forEach((block) => {
      expect(splitMarkdownBlocks(`${block}\n\nA`)).toEqual([block, 'A']);
    });
  });

  it('should keep a list whose items continue after a blank line as one block', () => {
    expect(splitMarkdownBlocks('- a\n\n  more of a\n\n\n- b\n\nAfter')).toEqual([
      '- a\n\n  more of a\n\n\n- b',
      'After',
    ]);
    expect(splitMarkdownBlocks('Intro\n1. a\n\n2) b\n\n')).toEqual(['Intro\n1. a\n\n2) b']);
    expect(splitMarkdownBlocks('- a\n\nAfter\n\n  indented')).toEqual([
      '- a',
      'After',
      '  indented',
    ]);
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

  it('should not take a code span for a fence', () => {
    expect(getFencedCodeLanguages('```inline``` code\n\n```js\na\n```')).toEqual(['js']);
  });

  it('should find the languages of tilde fences and with spaces before them', () => {
    expect(getFencedCodeLanguages('~~~ruby\na\n~~~\n\n```` python title\nb\n````')).toEqual([
      'python',
      'ruby',
    ]);
  });

  it('should return an empty list without code blocks', () => {
    expect(getFencedCodeLanguages('text')).toEqual([]);
  });
});

describe('getLinkDefinitions', () => {
  it('should get the link reference definitions', () => {
    expect(
      getLinkDefinitions(
        splitMarkdownBlocks(
          '[a]: /a\n\nText [a] [b] [c]\n\n> [b]: /b "B"\n\n- item\n\n  [c]:\n  /c\n\n[A]: /duplicate',
        ),
      ),
      // The first definition of a label wins, which is the one coming first
    ).toBe('[a]: /a\n[b]: /b "B"\n[c]:\n/c\n[A]: /duplicate');
  });

  it('should leave out what is not a definition', () => {
    expect(
      getLinkDefinitions(splitMarkdownBlocks('Text\n[a]: /a\n\n```\n[b]: /b\n\n```\n\n`[c]: /c`')),
    ).toBe('');
    expect(getLinkDefinitions(['No definitions'])).toBe('');
  });
});

describe('addLinkDefinitions', () => {
  it('should add the definitions to the start of each block', () => {
    expect(addLinkDefinitions(['A', '[a]: /a', '```\nB'])).toEqual([
      '[a]: /a\n\nA',
      '[a]: /a\n\n[a]: /a',
      '[a]: /a\n\n```\nB',
    ]);
    expect(addLinkDefinitions(['A'])).toEqual(['A']);
  });
});

describe('splitPreviewBlocks', () => {
  it('splits HTML into its top-level nodes', () => {
    expect(splitPreviewBlocks('<p>One</p><p>[a]</p>', { isHTML: true })).toEqual([
      '<p>One</p>',
      '<p>[a]</p>',
    ]);
  });

  it('splits Markdown into blocks with the link reference definitions added to each', () => {
    expect(splitPreviewBlocks('[a]\n\n[a]: https://example.com', { isHTML: false })).toEqual([
      '[a]: https://example.com\n\n[a]',
      '[a]: https://example.com\n\n[a]: https://example.com',
    ]);
  });

  it('splits Markdown without link reference definitions as it is', () => {
    expect(splitPreviewBlocks('One\n\nTwo', { isHTML: false })).toEqual(['One', 'Two']);
  });
});
