import { beforeEach, describe, expect, test, vi } from 'vitest';

import { addMessage } from '$lib/services/config/parser/utils/validator';

import { checkMultipleDefault, checkObjectDefault } from './defaults';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const context = { collection: { name: 'posts' }, typedKeyPath: 'author' };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/**
 * Assert the messages that were added, in order.
 * @param {object[]} messages Expected message properties.
 */
const expectMessages = (messages) => {
  expect(vi.mocked(addMessage).mock.calls.map(([args]) => args)).toEqual(
    messages.map((message) => ({ context, collectors, ...message })),
  );
};

describe('checkMultipleDefault', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Run the check.
   * @param {any} defaultValue The `default` option.
   * @param {boolean} [multiple] The `multiple` option.
   */
  const check = (defaultValue, multiple) => {
    checkMultipleDefault({ defaultValue, multiple, context, collectors });
  };

  test('skips a missing or null default', () => {
    check(undefined);
    check(undefined, true);
    // An empty `default:` line in YAML
    check(null, true);
    expectMessages([]);
  });

  test('accepts a single value without the multiple option, or with it off', () => {
    check('a');
    check(null, false);
    check(1, false);
    expectMessages([]);
  });

  test('accepts an array with the multiple option on', () => {
    check(['a', 'b'], true);
    check([], true);
    expectMessages([]);
  });

  test('reports an array without the multiple option', () => {
    check(['a']);
    check(['a'], false);
    expectMessages([{ strKey: 'invalid_default_single' }, { strKey: 'invalid_default_single' }]);
  });

  test('reports a single value with the multiple option on', () => {
    check('a', true);
    expectMessages([{ strKey: 'invalid_default_multiple' }]);
  });
});

describe('checkObjectDefault', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const fields = [
    { name: 'name', widget: 'string' },
    { name: 'email', widget: 'string' },
  ];

  const types = [{ name: 'text', fields: [{ name: 'body', widget: 'text' }] }, { name: 'divider' }];

  /**
   * Run the check with the `object_field` string key base.
   * @param {Record<string, any>} value Default object.
   * @param {Record<string, any>} [options] Field options.
   */
  const check = (value, options = {}) => {
    checkObjectDefault({ value, strKeyBase: 'object_field', context, collectors, ...options });
  };

  test('accepts an object with known properties', () => {
    check({ name: 'Alice', email: 'alice@example.com' }, { fields });
    check({ name: 'Alice' }, { fields });
    check({}, { fields });
    expectMessages([]);
  });

  test('reports each unknown property with the given key base', () => {
    check({ name: 'Alice', nmae: 'Alice', age: 30 }, { fields });
    expectMessages([
      { strKey: 'object_field_invalid_default_key', values: { key: 'nmae' } },
      { strKey: 'object_field_invalid_default_key', values: { key: 'age' } },
    ]);
  });

  test('uses the given key base', () => {
    checkObjectDefault({
      value: { nmae: 'Alice' },
      fields,
      strKeyBase: 'list_field',
      context,
      collectors,
    });

    expectMessages([{ strKey: 'list_field_invalid_default_key', values: { key: 'nmae' } }]);
  });

  test('accepts an object naming a type and its fields', () => {
    check({ type: 'text', body: 'a' }, { types });
    check({ type: 'divider' }, { types });
    expectMessages([]);
  });

  test('respects a custom type key', () => {
    check({ kind: 'text', body: 'a' }, { types, typeKey: 'kind' });
    expectMessages([]);
  });

  test('reports an object without the type key', () => {
    check({ body: 'a' }, { types });
    check({ type: 'text' }, { types, typeKey: 'kind' });
    expectMessages([
      { strKey: 'object_field_default_missing_type', values: { typeKey: 'type' } },
      { strKey: 'object_field_default_missing_type', values: { typeKey: 'kind' } },
    ]);
  });

  test('reports an unknown type name', () => {
    check({ type: 'image' }, { types });
    check({ type: 1 }, { types });
    expectMessages([
      { strKey: 'object_field_invalid_default_type', values: { typeKey: 'type', value: 'image' } },
      { strKey: 'object_field_invalid_default_type', values: { typeKey: 'type', value: '1' } },
    ]);
  });

  test('reports a property that is not a field of the named type', () => {
    check({ type: 'text', src: 'a.png' }, { types });
    check({ type: 'divider', body: 'a' }, { types });
    expectMessages([
      { strKey: 'object_field_invalid_default_key', values: { key: 'src' } },
      { strKey: 'object_field_invalid_default_key', values: { key: 'body' } },
    ]);
  });

  test('checks against the fields rather than the types if both are given', () => {
    check({ name: 'Alice' }, { fields, types });
    expectMessages([]);
  });
});
