import { describe, expect, test, vi } from 'vitest';

import {
  evaluateExpression,
  isValidExpression,
  parseExpression,
} from '$lib/services/contents/fields/compute/expression';

/**
 * Evaluate the given expression, resolving each template tag from the given values.
 * @param {string} expression Expression.
 * @param {Record<string, any>} [values] Values keyed by the tag content.
 * @returns {number | undefined} Result.
 */
const evaluate = (expression, values = {}) =>
  evaluateExpression(expression, (content) => values[content]);

describe('parseExpression()', () => {
  test('lists the template tags in the order they appear', () => {
    expect(
      parseExpression("{{fields.a}} * ({{fields.b | default('1')}} + {{index}})").tags,
    ).toEqual([
      { content: 'fields.a', allItems: false },
      { content: "fields.b | default('1')", allItems: false },
      { content: 'index', allItems: false },
    ]);
  });

  test('marks the template tags passed directly to an aggregate function', () => {
    expect(parseExpression('sum({{a.*.b}}, {{c}} * 2) + max({{a.*.b}}) + abs({{d}})').tags).toEqual(
      [
        { content: 'a.*.b', allItems: true },
        { content: 'c', allItems: false },
        { content: 'a.*.b', allItems: true },
        { content: 'd', allItems: false },
      ],
    );
  });

  test('builds a tree honoring the operator precedence', () => {
    expect(parseExpression('1 + 2 * -{{a}}').tree).toEqual({
      type: 'binary',
      operator: '+',
      left: { type: 'number', value: 1 },
      right: {
        type: 'binary',
        operator: '*',
        left: { type: 'number', value: 2 },
        right: { type: 'unary', operator: '-', operand: { type: 'tag', index: 0 } },
      },
    });
  });

  test('caches the result', () => {
    expect(parseExpression('1 + 1')).toBe(parseExpression('1 + 1'));
  });
});

describe('isValidExpression()', () => {
  test.each([
    '1',
    '.5',
    '1.25',
    '{{fields.a}}',
    '-{{fields.a}}',
    '+-1',
    '{{fields.a}} * {{fields.b}}',
    '({{fields.a}} + 1) / 2 % 3 - 4',
    '  1 +\n 2  ',
    'round({{fields.a}})',
    'round({{fields.a}}, 2)',
    'abs(-1) + ceil(1.2) + floor(1.8)',
    'sum({{fields.a.*.b}}) / count({{fields.a.*.b}})',
    'avg({{fields.a.*.b}}, 1, {{fields.c}} * 2)',
    'min(1) + max(1, 2, 3)',
    "{{fields.a | default('0')}} + {{fields.b | default('{{fields.c}}')}}",
  ])('accepts %j', (expression) => {
    expect(isValidExpression(expression)).toBe(true);
  });

  test.each([
    '',
    '   ',
    '1 +',
    '-',
    '2 * -',
    '* 2',
    '1 2',
    '{{fields.a}} {{fields.b}}',
    '(1 + 2',
    '1 + 2)',
    '()',
    '1..2',
    '1e3',
    '1 ** 2',
    '1 & 2',
    'foo(1)',
    'round',
    'round 1',
    'round()',
    'round(1, 2, 3)',
    'abs(1, 2)',
    'max()',
    'sum()',
    'sum',
    'count(,)',
    'max(1,)',
    'max(1 2)',
    'max(1',
    'constructor(1)',
    'toString(1)',
    'posts-{{fields.slug}}',
  ])('rejects %j', (expression) => {
    expect(isValidExpression(expression)).toBe(false);
  });
});

describe('evaluateExpression()', () => {
  test('evaluates the operators', () => {
    expect(evaluate('1 + 2')).toBe(3);
    expect(evaluate('5 - 7')).toBe(-2);
    expect(evaluate('6 * 7')).toBe(42);
    expect(evaluate('7 / 2')).toBe(3.5);
    expect(evaluate('7 % 3')).toBe(1);
    expect(evaluate('-(1 + 2)')).toBe(-3);
    expect(evaluate('+3')).toBe(3);
  });

  test('evaluates the operators of the same precedence from left to right', () => {
    expect(evaluate('10 - 4 - 3')).toBe(3);
    expect(evaluate('24 / 4 / 2')).toBe(3);
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
  });

  test('evaluates the functions', () => {
    expect(evaluate('abs(-2)')).toBe(2);
    expect(evaluate('ceil(1.2)')).toBe(2);
    expect(evaluate('floor(1.8)')).toBe(1);
    expect(evaluate('max(1, 3, 2)')).toBe(3);
    expect(evaluate('min(1, 3, 2)')).toBe(1);
    expect(evaluate('round(1.5)')).toBe(2);
    expect(evaluate('round(1.23456, 2)')).toBe(1.23);
    expect(evaluate('round(1.23456, 2.9)')).toBe(1.23);
    expect(evaluate('round(1234, -2)')).toBe(1200);
  });

  test('evaluates the aggregate functions over every item', () => {
    const values = { 'a.*.b': ['10', 5, '', null, ' 2.5 '], 'c.*.d': [] };

    expect(evaluate('sum({{a.*.b}})', values)).toBe(17.5);
    expect(evaluate('avg({{a.*.b}})', values)).toBe(17.5 / 3);
    expect(evaluate('count({{a.*.b}})', values)).toBe(3);
    expect(evaluate('max({{a.*.b}})', values)).toBe(10);
    expect(evaluate('min({{a.*.b}})', values)).toBe(2.5);
    expect(evaluate('sum({{a.*.b}}, {{c.*.d}}, 1, 2 * 3)', values)).toBe(24.5);
    expect(evaluate('max(1, 3, 2)')).toBe(3);
    expect(evaluate('count(1, 2)')).toBe(2);
  });

  test('accepts a single value from a tag passed to an aggregate function', () => {
    expect(evaluate('sum({{a}}, 1)', { a: '2' })).toBe(3);
    expect(evaluate('max({{a}}, 5)', {})).toBe(5);
  });

  test('handles an aggregate function with no value', () => {
    const values = { 'a.*.b': ['', null] };

    expect(evaluate('sum({{a.*.b}})', values)).toBe(0);
    expect(evaluate('count({{a.*.b}})', values)).toBe(0);
    expect(evaluate('avg({{a.*.b}})', values)).toBeUndefined();
    expect(evaluate('max({{a.*.b}})', values)).toBeUndefined();
    expect(evaluate('min({{a.*.b}})', values)).toBeUndefined();
  });

  test('counts values that are not numbers, but sums only numbers', () => {
    const values = { 'a.*.b': ['Beans', 'Filters'] };

    expect(evaluate('count({{a.*.b}})', values)).toBe(2);
    expect(evaluate('sum({{a.*.b}})', values)).toBeUndefined();
    expect(evaluate('sum({{c}} + 1, 2)', {})).toBeUndefined();
  });

  test('asks for every item of a tag passed to an aggregate function', () => {
    const resolveTag = vi.fn((_content, { allItems }) => (allItems ? ['1', '2'] : '3'));

    expect(evaluateExpression('sum({{a.*.b}}) + {{a.*.b}}', resolveTag)).toBe(6);
    expect(resolveTag.mock.calls).toEqual([
      ['a.*.b', { allItems: true }],
      ['a.*.b', { allItems: false }],
    ]);
  });

  test('uses the values the template tags resolve to as operands', () => {
    const values = { 'fields.price': '12.5', 'fields.quantity': 4, 'fields.discount': ' 10 ' };

    expect(
      evaluate('{{fields.price}} * {{fields.quantity}} * (1 - {{fields.discount}} / 100)', values),
    ).toBe(45);
    expect(evaluate('{{a}}', { a: '-1.5e2' })).toBe(-150);
    expect(evaluate('{{a}}', { a: '+.5' })).toBe(0.5);
    expect(evaluate('{{a}}', { a: '3.' })).toBe(3);
  });

  test('resolves each template tag once, in order', () => {
    const resolveTag = vi.fn(() => '2');

    expect(evaluateExpression('{{a}} + {{b}} * {{a}}', resolveTag)).toBe(6);
    expect(resolveTag.mock.calls).toEqual([
      ['a', { allItems: false }],
      ['b', { allItems: false }],
      ['a', { allItems: false }],
    ]);
  });

  test('keeps a value from changing the structure of the expression', () => {
    expect(evaluate('{{a}} * 2', { a: '1 + 1' })).toBeUndefined();
    expect(evaluate('{{a}} * 2', { a: '2) * (3' })).toBeUndefined();
  });

  test('returns `undefined` if a template tag resolves to something other than a number', () => {
    expect(evaluate('{{a}} + 1', { a: '' })).toBeUndefined();
    expect(evaluate('{{a}} + 1', { a: '  ' })).toBeUndefined();
    expect(evaluate('{{a}} + 1', { a: null })).toBeUndefined();
    expect(evaluate('{{a}} + 1', {})).toBeUndefined();
    expect(evaluate('{{a}} + 1', { a: 'abc' })).toBeUndefined();
    expect(evaluate('{{a}} + 1', { a: 'true' })).toBeUndefined();
    expect(evaluate('{{a}} + 1', { a: '0x10' })).toBeUndefined();
    expect(evaluate('{{a}} + 1', { a: '1,234' })).toBeUndefined();
    expect(evaluate('{{a}} + 1', { a: 'Infinity' })).toBeUndefined();
    expect(evaluate('-{{a}}', {})).toBeUndefined();
    expect(evaluate('abs({{a}})', {})).toBeUndefined();
  });

  test('returns `undefined` if the result is not a finite number', () => {
    expect(evaluate('1 / 0')).toBeUndefined();
    expect(evaluate('0 / 0')).toBeUndefined();
    expect(evaluate('1 % 0')).toBeUndefined();
    expect(evaluate('{{a}} * 10', { a: '1e308' })).toBeUndefined();
  });

  test('returns `undefined` if the expression is invalid', () => {
    const resolveTag = vi.fn(() => '1');

    expect(evaluateExpression('{{a}} +', resolveTag)).toBeUndefined();
    expect(resolveTag).not.toHaveBeenCalled();
  });
});
