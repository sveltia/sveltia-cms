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
});
