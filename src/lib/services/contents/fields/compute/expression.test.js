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
  evaluateExpression(expression, (placeholder) => values[placeholder]);

describe('parseExpression()', () => {
  test('lists the template tags in the order they appear', () => {
    expect(
      parseExpression("{{fields.a}} * ({{fields.b | default('1')}} + {{index}})").tags,
    ).toEqual(['fields.a', "fields.b | default('1')", 'index']);
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
    expect(resolveTag.mock.calls).toEqual([['a'], ['b'], ['a']]);
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
    expect(evaluate('max(1, {{a}})', {})).toBeUndefined();
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
