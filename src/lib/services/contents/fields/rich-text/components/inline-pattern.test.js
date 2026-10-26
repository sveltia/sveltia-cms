import { describe, expect, it } from 'vitest';

import {
  createInlineMatcher,
  findInlineMatches,
  getInlinePattern,
  isInlinePatternComponent,
  resolveInlinePatternComponent,
} from '$lib/services/contents/fields/rich-text/components/inline-pattern';

/**
 * Get the matched strings and their indexes.
 * @param {RegExpExecArray[]} matches Matches.
 * @returns {[string, number][]} Strings and indexes.
 */
const summarize = (matches) => matches.map((match) => [match[0], match.index]);

describe('isInlinePatternComponent', () => {
  it('should tell a component with the `inline` type', () => {
    expect(isInlinePatternComponent({ type: 'inline' })).toBe(true);
  });

  it('should not tell any other component', () => {
    expect(isInlinePatternComponent({ type: 'block' })).toBe(false);
    expect(isInlinePatternComponent(/** @type {any} */ ({ mode: 'inline' }))).toBe(false);
    expect(isInlinePatternComponent(undefined)).toBe(false);
  });
});

describe('getInlinePattern', () => {
  it('should remove a leading caret and the `g` and `y` flags', () => {
    const pattern = getInlinePattern(/^\[\[(.+?)\]\]/giy);

    expect(pattern.source).toBe('\\[\\[(.+?)\\]\\]');
    expect(pattern.flags).toBe('i');
  });

  it('should keep a pattern without a leading caret as is', () => {
    const pattern = getInlinePattern(/@(\w+)/u);

    expect(pattern.source).toBe('@(\\w+)');
    expect(pattern.flags).toBe('u');
  });
});

describe('resolveInlinePatternComponent', () => {
  /* eslint-disable jsdoc/require-jsdoc */
  const fromInline = (/** @type {RegExpMatchArray} */ match) => ({ page: match[1] });
  const toInline = ({ page = '' }) => `[[${page}]]`;
  const toPreview = ({ page = '' }) => `<a>${page}</a>`;
  const onInsert = async () => ({ page: 'a' });
  const onEdit = async () => null;
  /* eslint-enable jsdoc/require-jsdoc */

  it('should convert the definition to the shape of a field-based one', () => {
    expect(
      resolveInlinePatternComponent({
        id: 'wikilink',
        label: 'Wikilink',
        icon: 'link',
        type: 'inline',
        pattern: /^\[\[(.+?)\]\]/g,
        trigger: '[[',
        fromInline,
        toInline,
        toPreview,
        onInsert,
        onEdit,
      }),
    ).toEqual({
      id: 'wikilink',
      label: 'Wikilink',
      icon: 'link',
      fields: [],
      pattern: /\[\[(.+?)\]\]/,
      fromBlock: fromInline,
      toBlock: toInline,
      toPreview,
      inlinePattern: { trigger: '[[', onInsert, onEdit },
    });
  });

  it('should fall back to `fromBlock` and `toBlock`', () => {
    /* eslint-disable jsdoc/require-jsdoc */
    const fromBlock = () => ({});
    const toBlock = () => '';
    /* eslint-enable jsdoc/require-jsdoc */

    const resolved = resolveInlinePatternComponent(
      /** @type {any} */ ({ id: 'x', type: 'inline', pattern: /x/, fromBlock, toBlock }),
    );

    expect(resolved.fromBlock).toBe(fromBlock);
    expect(resolved.toBlock).toBe(toBlock);
    expect(resolved.inlinePattern).toEqual({
      trigger: undefined,
      onInsert: undefined,
      onEdit: undefined,
    });
  });

  it('should ignore an empty trigger', () => {
    const resolved = resolveInlinePatternComponent({
      id: 'x',
      type: 'inline',
      pattern: /x/,
      trigger: '',
      toInline,
    });

    expect(resolved.inlinePattern?.trigger).toBeUndefined();
  });
});

describe('findInlineMatches', () => {
  const wikilink = /\[\[(?<page>[^\]]+)\]\]/;

  it('should find every instance without a trigger', () => {
    expect(summarize(findInlineMatches('See [[A]] and [[B]].', wikilink))).toEqual([
      ['[[A]]', 4],
      ['[[B]]', 14],
    ]);
  });

  it('should find every instance with a trigger', () => {
    const matches = findInlineMatches('See [[A]] and [[B]].', wikilink, { trigger: '[[' });

    expect(summarize(matches)).toEqual([
      ['[[A]]', 4],
      ['[[B]]', 14],
    ]);
    expect(matches[1].groups?.page).toBe('B');
  });

  it('should only match where the trigger is found', () => {
    // The pattern matches `b` without the `@`, but the instance has to start at the trigger
    expect(summarize(findInlineMatches('a @@b c @d', /@?\w/, { trigger: '@' }))).toEqual([
      ['@b', 3],
      ['@d', 8],
    ]);
  });

  it('should skip a trigger the pattern doesn’t match at', () => {
    expect(summarize(findInlineMatches('[[] [[A]]', wikilink, { trigger: '[[' }))).toEqual([
      ['[[A]]', 4],
    ]);
  });

  it('should match CJK text and punctuation around an instance', () => {
    expect(
      summarize(findInlineMatches('這是一個[[測試頁面]]，請點擊！', wikilink, { trigger: '[[' })),
    ).toEqual([['[[測試頁面]]', 4]]);
  });

  it('should skip empty matches', () => {
    expect(summarize(findInlineMatches('a-b', /-?/))).toEqual([['-', 1]]);
    expect(summarize(findInlineMatches('@a', /(?:)/, { trigger: '@' }))).toEqual([]);
  });

  it('should return nothing without an instance', () => {
    expect(findInlineMatches('No link', wikilink)).toEqual([]);
    expect(findInlineMatches('No link', wikilink, { trigger: '[[' })).toEqual([]);
  });

  it('should stop at the limit', () => {
    expect(summarize(findInlineMatches('[[A]] [[B]]', wikilink, {}, 1))).toEqual([['[[A]]', 0]]);
    expect(summarize(findInlineMatches('[[A]] [[B]]', wikilink, { trigger: '[[' }, 1))).toEqual([
      ['[[A]]', 0],
    ]);
  });
});

describe('createInlineMatcher', () => {
  it('should find the first instance with `String.prototype.match()`', () => {
    const matcher = createInlineMatcher(/@?\w+/, { trigger: '@' });
    const match = 'Hi @bob and @alice'.match(matcher);

    expect(matcher).toBeInstanceOf(RegExp);
    expect(match?.[0]).toBe('@bob');
    expect(match?.index).toBe(3);
  });

  it('should return `null` without an instance', () => {
    expect('Hi all'.match(createInlineMatcher(/@\w+/, { trigger: '@' }))).toBeNull();
  });
});
