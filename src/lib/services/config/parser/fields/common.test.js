import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkCommonFieldOptions } from '$lib/services/config/parser/fields/common';
import { addMessage, checkRegex } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const context = { collection: { name: 'posts' }, typedKeyPath: 'title' };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/**
 * Run the check on a field with the given options.
 * @param {object} options Field options.
 * @returns {void}
 */
const check = (options) =>
  checkCommonFieldOptions({
    config: /** @type {any} */ ({ name: 'title', widget: 'string', ...options }),
    context,
    collectors,
  });

/**
 * Assert that a range was reported.
 * @param {string} min Lower bound option name.
 * @param {string} max Upper bound option name.
 */
const expectRange = (min, max) => {
  expect(addMessage).toHaveBeenCalledExactlyOnceWith({
    strKey: 'invalid_range_options',
    values: { min, max },
    context,
    collectors,
  });
};

describe('checkCommonFieldOptions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('says nothing without the options', () => {
    check({});
    expect(addMessage).not.toHaveBeenCalled();
    expect(checkRegex).not.toHaveBeenCalled();
  });

  test('checks the regular expression of a pattern', () => {
    check({ pattern: ['^\\d+$', 'Numbers only'] });

    expect(checkRegex).toHaveBeenCalledExactlyOnceWith({
      option: 'pattern',
      pattern: '^\\d+$',
      context,
      collectors,
    });
  });

  test('leaves a pattern of the wrong type to the schema', () => {
    check({ pattern: '^\\d+$' });
    expect(checkRegex).not.toHaveBeenCalled();
  });

  test('accepts ranges in the right order', () => {
    check({ min: 1, max: 5 });
    check({ min: 3, max: 3 });
    check({ minlength: 0, maxlength: 100 });
    check({ min: 5 });
    check({ maxlength: 5 });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports a minimum above the maximum', () => {
    check({ min: 5, max: 1 });
    expectRange('min', 'max');
  });

  test('reports a minimum length above the maximum length', () => {
    check({ minlength: 100, maxlength: 10 });
    expectRange('minlength', 'maxlength');
  });

  test('reports both ranges of one field', () => {
    check({ min: 5, max: 1, minlength: 100, maxlength: 10 });
    expect(addMessage).toHaveBeenCalledTimes(2);
  });

  test('leaves bounds of the wrong type to the schema', () => {
    check({ min: '5', max: 1 });
    check({ min: 5, max: null });
    expect(addMessage).not.toHaveBeenCalled();
  });
});
