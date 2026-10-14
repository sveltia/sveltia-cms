import { describe, expect, test, vi } from 'vitest';

import { processNestedTemplates } from './nested';

/**
 * @import { StringTransformation } from '$lib/types/private';
 */

/**
 * Resolve a tag for the tests by wrapping it in brackets.
 * @param {string} tag Tag.
 * @returns {string} Resolved value.
 */
const resolveTag = (tag) => `[${tag}]`;

describe('processNestedTemplates()', () => {
  test('returns an empty array for no transformations', () => {
    expect(processNestedTemplates([], resolveTag)).toEqual([]);
  });

  test('resolves a nested template in the `default` transformation', () => {
    /** @type {StringTransformation[]} */
    const transformations = [{ method: 'default', args: { defaultValue: '{{fields.title}}' } }];

    expect(processNestedTemplates(transformations, resolveTag)).toEqual([
      { method: 'default', args: { defaultValue: '[fields.title]' } },
    ]);
  });

  test('resolves nested templates in the `ternary` transformation', () => {
    /** @type {StringTransformation[]} */
    const transformations = [
      { method: 'ternary', args: { truthyValue: '{{subtitle}}', falsyValue: '{{title}}' } },
    ];

    expect(processNestedTemplates(transformations, resolveTag)).toEqual([
      { method: 'ternary', args: { truthyValue: '[subtitle]', falsyValue: '[title]' } },
    ]);
  });

  test('resolves only the `ternary` arguments that hold a template', () => {
    /** @type {StringTransformation[]} */
    const transformations = [
      { method: 'ternary', args: { truthyValue: 'Yes', falsyValue: '{{title}}' } },
      { method: 'ternary', args: { truthyValue: '{{title}}', falsyValue: 'No' } },
    ];

    expect(processNestedTemplates(transformations, resolveTag)).toEqual([
      { method: 'ternary', args: { truthyValue: 'Yes', falsyValue: '[title]' } },
      { method: 'ternary', args: { truthyValue: '[title]', falsyValue: 'No' } },
    ]);
  });

  test('returns the same objects for transformations without a nested template', () => {
    /** @type {StringTransformation[]} */
    const transformations = [
      { method: 'upper', args: {} },
      { method: 'default', args: { defaultValue: 'Untitled' } },
      { method: 'ternary', args: { truthyValue: 'Yes', falsyValue: '' } },
      { method: 'truncate', args: { max: '10', ellipsis: '…' } },
    ];

    const resolver = vi.fn(resolveTag);
    const result = processNestedTemplates(transformations, resolver);

    expect(result).not.toBe(transformations);
    result.forEach((tf, index) => {
      expect(tf).toBe(transformations[index]);
    });
    expect(resolver).not.toHaveBeenCalled();
  });

  test('resolves a template mixed with other text', () => {
    /** @type {StringTransformation[]} */
    const transformations = [
      { method: 'default', args: { defaultValue: 'prefix-{{title}}' } },
      { method: 'default', args: { defaultValue: '{{title}} (draft)' } },
    ];

    expect(processNestedTemplates(transformations, resolveTag)).toEqual([
      { method: 'default', args: { defaultValue: 'prefix-[title]' } },
      { method: 'default', args: { defaultValue: '[title] (draft)' } },
    ]);
  });

  test('resolves every template in an argument', () => {
    /** @type {StringTransformation[]} */
    const transformations = [
      { method: 'default', args: { defaultValue: '{{a}}-{{b}}' } },
      { method: 'ternary', args: { truthyValue: '{{a}} {{b}}', falsyValue: 'No' } },
    ];

    const resolver = vi.fn(resolveTag);

    expect(processNestedTemplates(transformations, resolver)).toEqual([
      { method: 'default', args: { defaultValue: '[a]-[b]' } },
      { method: 'ternary', args: { truthyValue: '[a] [b]', falsyValue: 'No' } },
    ]);
    expect(resolver.mock.calls).toEqual([['a'], ['b'], ['a'], ['b']]);
  });

  test('leaves an incomplete or empty template alone', () => {
    /** @type {StringTransformation[]} */
    const transformations = [
      { method: 'default', args: { defaultValue: '{{}}' } },
      { method: 'default', args: { defaultValue: '{{title' } },
      { method: 'default', args: { defaultValue: 'title}}' } },
    ];

    const resolver = vi.fn(resolveTag);
    const result = processNestedTemplates(transformations, resolver);

    result.forEach((tf, index) => {
      expect(tf).toBe(transformations[index]);
    });
    expect(resolver).not.toHaveBeenCalled();
  });

  test('replaces a tag the resolver returns nothing for with an empty string', () => {
    /** @type {StringTransformation[]} */
    const transformations = [{ method: 'default', args: { defaultValue: '{{missing}}' } }];
    const resolver = vi.fn().mockReturnValue(undefined);

    expect(processNestedTemplates(transformations, resolver)).toEqual([
      { method: 'default', args: { defaultValue: '' } },
    ]);
  });

  test('converts a non-string resolved value to a string', () => {
    /** @type {StringTransformation[]} */
    const transformations = [{ method: 'default', args: { defaultValue: '{{count}}' } }];
    const resolver = vi.fn().mockReturnValue(42);

    expect(processNestedTemplates(transformations, resolver)).toEqual([
      { method: 'default', args: { defaultValue: '42' } },
    ]);
  });

  test('keeps a template that resolves to itself unchanged', () => {
    /** @type {StringTransformation[]} */
    const transformations = [{ method: 'default', args: { defaultValue: '{{title}}' } }];
    const result = processNestedTemplates(transformations, () => '{{title}}');

    expect(result[0]).toBe(transformations[0]);
  });

  test('copies a changed transformation rather than modifying the frozen original', () => {
    const args = Object.freeze({ defaultValue: '{{title}}', other: 'kept' });
    const transformation = Object.freeze({ method: 'default', args });
    const [result] = processNestedTemplates([transformation], resolveTag);

    expect(result).not.toBe(transformation);
    expect(result).toEqual({ method: 'default', args: { defaultValue: '[title]', other: 'kept' } });
    expect(transformation.args.defaultValue).toBe('{{title}}');
  });

  test('processes each transformation in a chain', () => {
    /** @type {StringTransformation[]} */
    const transformations = [
      { method: 'ternary', args: { truthyValue: '{{a}}', falsyValue: '{{b}}' } },
      { method: 'upper', args: {} },
      { method: 'default', args: { defaultValue: '{{c}}' } },
    ];

    const resolver = vi.fn(resolveTag);
    const result = processNestedTemplates(transformations, resolver);

    expect(result).toEqual([
      { method: 'ternary', args: { truthyValue: '[a]', falsyValue: '[b]' } },
      { method: 'upper', args: {} },
      { method: 'default', args: { defaultValue: '[c]' } },
    ]);
    expect(result[1]).toBe(transformations[1]);
    expect(resolver.mock.calls).toEqual([['a'], ['b'], ['c']]);
  });

  test('resolves nested templates in the string arguments of a custom transformation', () => {
    /** @type {StringTransformation[]} */
    const transformations = [
      { method: 'wrap', args: {}, customArgs: ['{{a}} and {{b}}', 3, 'plain'] },
    ];

    expect(processNestedTemplates(transformations, resolveTag)).toEqual([
      { method: 'wrap', args: {}, customArgs: ['[a] and [b]', 3, 'plain'] },
    ]);
  });

  test('keeps a custom transformation without nested templates as is', () => {
    /** @type {StringTransformation[]} */
    const transformations = [
      { method: 'wrap', args: {}, customArgs: ['[', 3] },
      { method: 'reverse', args: {} },
    ];

    const result = processNestedTemplates(transformations, resolveTag);

    expect(result[0]).toBe(transformations[0]);
    expect(result[1]).toBe(transformations[1]);
  });
});
