import { beforeEach, describe, expect, test, vi } from 'vitest';

import { parseCodeFieldConfig } from '$lib/services/config/parser/fields/code';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const context = { collection: { name: 'posts' }, typedKeyPath: 'snippet' };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/**
 * Parse a Code field with the given options.
 * @param {object} options Field options.
 * @returns {void}
 */
const check = (options) =>
  parseCodeFieldConfig({
    config: /** @type {any} */ ({ name: 'snippet', widget: 'code', ...options }),
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

describe('parseCodeFieldConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('accepts a missing or string default in either mode', () => {
    check({});
    check({ default: 'const a = 1;' });
    check({ default: 'const a = 1;', output_code_only: true });
    check({ output_code_only: true });
    expectMessages([]);
  });

  test('leaves a default of another type to the schema', () => {
    check({ default: 1 });
    check({ default: ['a'], output_code_only: true });
    expectMessages([]);
  });

  test('accepts an object default with the default keys', () => {
    check({ default: { code: 'const a = 1;', lang: 'js' } });
    check({ default: { code: 'const a = 1;' } });
    check({ default: { code: 'const a = 1;', lang: 'js' }, output_code_only: false });
    expectMessages([]);
  });

  test('accepts an object default with custom keys', () => {
    check({
      default: { source: 'const a = 1;', language: 'js' },
      keys: { code: 'source', lang: 'language' },
    });
    expectMessages([]);
  });

  test('reports an object default when the code only is output', () => {
    check({ default: { code: 'const a = 1;', lang: 'js' }, output_code_only: true });
    expectMessages([{ strKey: 'code_field_invalid_default_object' }]);
  });

  test('reports each property that is not one of the keys', () => {
    check({ default: { code: 'const a = 1;', language: 'js', foo: 'bar' } });
    expectMessages([
      {
        strKey: 'code_field_invalid_default_key',
        values: { key: 'language', code: 'code', lang: 'lang' },
      },
      {
        strKey: 'code_field_invalid_default_key',
        values: { key: 'foo', code: 'code', lang: 'lang' },
      },
    ]);
  });

  test('reports the default keys in the message when custom keys are configured', () => {
    check({ default: { code: 'const a = 1;' }, keys: { code: 'source', lang: 'language' } });
    expectMessages([
      {
        strKey: 'code_field_invalid_default_key',
        values: { key: 'code', code: 'source', lang: 'language' },
      },
    ]);
  });
});
