import { beforeEach, describe, expect, test, vi } from 'vitest';

import { parseNumberFieldConfig } from '$lib/services/config/parser/fields/number';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const context = { collection: { name: 'posts' }, typedKeyPath: 'count' };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/**
 * Parse a Number field with the given `step` option.
 * @param {any} step The option value.
 * @returns {void}
 */
const check = (step) =>
  parseNumberFieldConfig({
    config: /** @type {any} */ ({ name: 'count', widget: 'number', step }),
    context,
    collectors,
  });

/**
 * Parse a Number field with the given `default` and `value_type` options.
 * @param {any} defaultValue The `default` option.
 * @param {any} [valueType] The `value_type` option.
 * @returns {void}
 */
const checkDefault = (defaultValue, valueType) =>
  parseNumberFieldConfig({
    config: /** @type {any} */ ({
      name: 'count',
      widget: 'number',
      default: defaultValue,
      value_type: valueType,
    }),
    context,
    collectors,
  });

/**
 * Assert the messages that were added, in order.
 * @param {object[]} messages Expected message properties.
 */
const expectMessages = (messages) => {
  expect(vi.mocked(addMessage).mock.calls.map(([args]) => args)).toEqual(
    messages.map((message) => ({ context, collectors, ...message })),
  );
};

describe('parseNumberFieldConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('accepts a positive step, any, or none', () => {
    check(1);
    check(0.5);
    check('any');
    check(undefined);
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports a step of zero or less', () => {
    check(0);
    check(-1);

    expect(vi.mocked(addMessage).mock.calls.map(([args]) => args)).toEqual([
      { strKey: 'invalid_step', values: { step: '0' }, context, collectors },
      { strKey: 'invalid_step', values: { step: '-1' }, context, collectors },
    ]);
  });

  test('leaves a step of the wrong type to the schema', () => {
    check('0');
    check(null);
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('accepts an integer default for the integer value types', () => {
    checkDefault(1);
    checkDefault(-1, 'int');
    checkDefault('42', 'int');
    checkDefault(0, 'int/string');
    checkDefault('7', 'int/string');
    expectMessages([]);
  });

  test('accepts a number default for the float value types', () => {
    checkDefault(1.5, 'float');
    checkDefault('1.5', 'float');
    checkDefault(2, 'float');
    checkDefault('-0.25', 'float/string');
    expectMessages([]);
  });

  test('parses a string default the way the runtime does', () => {
    // `parseInt()` and `parseFloat()` stop at the first character that is not part of a number
    checkDefault('1.5', 'int');
    checkDefault('3px', 'float');
    expectMessages([]);
  });

  test('reports a default that is not an integer for the integer value types', () => {
    checkDefault(1.5);
    checkDefault('abc', 'int');
    checkDefault(Number.NaN, 'int/string');
    expectMessages([
      { strKey: 'number_field_default_not_integer', values: { value: '1.5', valueType: 'int' } },
      { strKey: 'number_field_default_not_integer', values: { value: 'abc', valueType: 'int' } },
      {
        strKey: 'number_field_default_not_integer',
        values: { value: 'NaN', valueType: 'int/string' },
      },
    ]);
  });

  test('reports a default that is not a number for the float value types', () => {
    checkDefault('abc', 'float');
    checkDefault(Number.POSITIVE_INFINITY, 'float/string');
    expectMessages([
      { strKey: 'number_field_default_not_number', values: { value: 'abc', valueType: 'float' } },
      {
        strKey: 'number_field_default_not_number',
        values: { value: 'Infinity', valueType: 'float/string' },
      },
    ]);
  });

  test('leaves a default or value type of the wrong type to the schema', () => {
    checkDefault(undefined);
    checkDefault(null, 'int');
    checkDefault(true, 'float');
    checkDefault('abc', 'decimal');
    expectMessages([]);
  });
});
