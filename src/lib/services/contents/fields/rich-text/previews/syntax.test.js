import { describe, expect, test } from 'vitest';

import { getCodeRanges, isWithinHTMLBlock, isWithinRanges, startsHTMLBlock } from './syntax';

/**
 * Get the text of the code ranges in the given Markdown.
 * @param {string} markdown Markdown.
 * @returns {string[]} Code.
 */
const getCode = (markdown) =>
  getCodeRanges(markdown).map(([start, end]) => markdown.slice(start, end));

describe('getCodeRanges()', () => {
  test('finds code spans', () => {
    expect(getCode('Use `a` and ``b ` c`` here, `not closed')).toEqual(['`a`', '``b ` c``']);
    expect(getCode('No code')).toEqual([]);
    expect(getCode('')).toEqual([]);
  });

  test('closes a code span with a run of the same length only', () => {
    expect(getCode('``a`b```c``')).toEqual(['``a`b```c``']);
    expect(getCode('```a`` b')).toEqual([]);
  });

  test('finds a code span spanning lines within a paragraph, not across paragraphs', () => {
    expect(getCode('`a\nb`')).toEqual(['`a\nb`']);
    expect(getCode('`a\n\nb`')).toEqual([]);
    expect(getCode('`a\n  \nb` `c`')).toEqual(['` `']);
  });

  test('skips an escaped backtick', () => {
    expect(getCode('\\`a` `b`')).toEqual(['` `']);
    expect(getCode('\\\\`a`')).toEqual(['`a`']);
  });

  test('finds fenced code blocks with backticks or tildes', () => {
    const markdown = 'A `b`\n\n```js\n`c`\n```\n\n~~~~\n```\n~~~~\n\n  ```\n  d\n  ```\n\nE `f`';

    expect(getCode(markdown)).toEqual([
      '`b`',
      '```js\n`c`\n```',
      '~~~~\n```\n~~~~',
      // From the fence, not the indentation
      '```\n  d\n  ```',
      '`f`',
    ]);
  });

  test('closes a fence with a fence of the same character at least as long', () => {
    expect(getCode('````\na\n```\nb\n`````  \nc')).toEqual(['````\na\n```\nb\n`````  ']);
    expect(getCode('```\na\n``` b\n```')).toEqual(['```\na\n``` b\n```']);
  });

  test('runs an unclosed fence to the end', () => {
    expect(getCode('`a`\n```\nb `c`')).toEqual(['`a`', '```\nb `c`']);
  });

  test('doesn’t take a backtick run with a backtick in its info string for a fence', () => {
    expect(getCode('```a`b```\nc')).toEqual(['```a`b```']);
  });
});

describe('isWithinRanges()', () => {
  test('checks the index after the start and before the end', () => {
    expect(isWithinRanges(0, [[0, 3]])).toBe(false);
    expect(isWithinRanges(1, [[0, 3]])).toBe(true);
    expect(isWithinRanges(3, [[0, 3]])).toBe(false);
    expect(
      isWithinRanges(5, [
        [0, 3],
        [4, 6],
      ]),
    ).toBe(true);
    expect(isWithinRanges(1, [])).toBe(false);
  });
});

describe('startsHTMLBlock()', () => {
  test('detects a block-level tag at the start of a line', () => {
    expect(startsHTMLBlock('<div class="a">Text</div>')).toBe(true);
    expect(startsHTMLBlock('   </ASIDE>')).toBe(true);
    expect(startsHTMLBlock('<p>')).toBe(true);
    expect(startsHTMLBlock('<hr/>')).toBe(true);
    expect(startsHTMLBlock('<h2')).toBe(true);
    expect(startsHTMLBlock('<div>', { afterParagraph: true })).toBe(true);
    expect(startsHTMLBlock('    <div>')).toBe(false);
    expect(startsHTMLBlock('<divider> Text')).toBe(false);
    expect(startsHTMLBlock('Text <div>')).toBe(false);
  });

  test('detects a lone tag of another element unless it follows a paragraph', () => {
    expect(startsHTMLBlock('<img src="a.png" alt=\'b\' hidden data-x=1 />')).toBe(true);
    expect(startsHTMLBlock('<my-element>  ')).toBe(true);
    expect(startsHTMLBlock('</span>')).toBe(true);
    expect(startsHTMLBlock('<img src="a.png">', { afterParagraph: true })).toBe(false);
    expect(startsHTMLBlock('<img src="a.png"> Text')).toBe(false);
    expect(startsHTMLBlock('<span></span>')).toBe(false);
    // These start a block that ends with the closing tag
    expect(startsHTMLBlock('<pre>')).toBe(false);
    expect(startsHTMLBlock('<script src="a.js">')).toBe(false);
  });
});

describe('isWithinHTMLBlock()', () => {
  test('checks the lines since the previous blank line', () => {
    const markdown = 'Text\n<div>\nA\n\nB\n<img>\nC\n\n<img>\nD';

    expect(isWithinHTMLBlock(markdown, 0)).toBe(false);
    expect(isWithinHTMLBlock(markdown, markdown.indexOf('<div>'))).toBe(false);
    // A block-level tag interrupts a paragraph
    expect(isWithinHTMLBlock(markdown, markdown.indexOf('A'))).toBe(true);
    expect(isWithinHTMLBlock(markdown, markdown.indexOf('B'))).toBe(false);
    // A lone tag of another element doesn’t
    expect(isWithinHTMLBlock(markdown, markdown.indexOf('C'))).toBe(false);
    expect(isWithinHTMLBlock(markdown, markdown.indexOf('D'))).toBe(true);
  });
});
