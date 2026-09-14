import { beforeEach, describe, expect, test, vi } from 'vitest';

import { parseSelectFieldConfig } from '$lib/services/config/parser/fields/select';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const context = { collection: { name: 'posts' }, typedKeyPath: 'category' };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/**
 * Parse a Select field with the given options.
 * @param {object} options Field options.
 * @returns {void}
 */
const check = (options) =>
  parseSelectFieldConfig({
    config: /** @type {any} */ ({ name: 'category', widget: 'select', ...options }),
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

describe('parseSelectFieldConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('leaves missing or wrongly typed options to the schema', () => {
    check({});
    check({ options: 'a, b' });
    expectMessages([]);
  });

  test('accepts plain and labelled options', () => {
    check({ options: ['a', 'b', 1, null] });
    check({
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    });
    check({ options: ['a', { label: 'B', value: 'b' }] });
    expectMessages([]);
  });

  test('reports an empty list and nothing else about it', () => {
    check({ options: [], default: 'a' });
    expectMessages([{ strKey: 'select_field_no_options' }]);
  });

  test('reports each duplicated value once', () => {
    check({ options: ['a', 'b', 'a', { label: 'B', value: 'b' }, 'a'] });
    expectMessages([
      { strKey: 'select_field_duplicate_option', values: { value: 'a' } },
      { strKey: 'select_field_duplicate_option', values: { value: 'b' } },
    ]);
  });

  test('tells a number from a string of the same digits', () => {
    check({ options: [1, '1'] });
    expectMessages([]);
  });

  test('accepts a default among the options', () => {
    check({ options: ['a', 'b'], default: 'b' });
    check({ options: [{ label: 'A', value: 'a' }], default: 'a' });
    check({ options: ['a', 'b'], default: ['a', 'b'] });
    check({ options: [1, null], default: null });
    expectMessages([]);
  });

  test('reports a default that is not among the options', () => {
    check({ options: ['a', 'b'], default: 'c' });
    expectMessages([{ strKey: 'select_field_invalid_default', values: { value: 'c' } }]);
  });

  test('reports each default value that is not among the options', () => {
    check({ options: ['a', 'b'], default: ['a', 'c', 1] });
    expectMessages([
      { strKey: 'select_field_invalid_default', values: { value: 'c' } },
      { strKey: 'select_field_invalid_default', values: { value: '1' } },
    ]);
  });
});
