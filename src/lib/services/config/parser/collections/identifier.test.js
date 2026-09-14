import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkIdentifierField } from '$lib/services/config/parser/collections/identifier';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/**
 * @import { Field } from '$lib/types/public';
 */

/** @type {any} */
const context = { collection: { name: 'posts' } };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/** @type {Field[]} */
const withTitle = /** @type {any} */ ([
  { name: 'title', widget: 'string' },
  { name: 'body', widget: 'markdown' },
]);

/** @type {Field[]} */
const withoutTitle = /** @type {any} */ ([
  { name: 'name', widget: 'string' },
  { name: 'meta', widget: 'object', fields: [{ name: 'heading', widget: 'string' }] },
]);

/**
 * Run the check on a folder collection with the given options.
 * @param {object} [options] Collection options to override.
 * @returns {void}
 */
const check = (options = {}) =>
  checkIdentifierField({
    collection: /** @type {any} */ ({
      name: 'posts',
      folder: 'content/posts',
      fields: withTitle,
      ...options,
    }),
    context,
    collectors,
  });

/**
 * Assert that the named identifier field was reported as missing.
 * @param {string} name Field name the message names.
 */
const expectInvalid = (name) => {
  expect(addMessage).toHaveBeenCalledExactlyOnceWith({
    strKey: 'invalid_identifier_field',
    values: { name },
    context,
    collectors,
  });
};

/**
 * Assert that the warning about the default identifier field was added.
 */
const expectMissing = () => {
  expect(addMessage).toHaveBeenCalledExactlyOnceWith({
    type: 'warning',
    strKey: 'missing_identifier_field',
    values: { name: 'title' },
    context,
    collectors,
  });
};

describe('checkIdentifierField', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('with the identifier_field option', () => {
    test('accepts a field defined in the collection', () => {
      check({ fields: withoutTitle, identifier_field: 'name' });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('accepts a nested key path', () => {
      check({ fields: withoutTitle, identifier_field: 'meta.heading' });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('reports a field that is not defined in the collection', () => {
      check({ identifier_field: 'name' });
      expectInvalid('name');
    });

    test('reports a nested key path that leads nowhere', () => {
      check({ fields: withoutTitle, identifier_field: 'meta.title' });
      expectInvalid('meta.title');
    });

    test('reports the field whether or not the collection has a title field', () => {
      check({ fields: withoutTitle, identifier_field: 'headline' });
      expectInvalid('headline');
    });

    test('reports the field even when entries can’t be created', () => {
      check({ identifier_field: 'name', create: false });
      expectInvalid('name');
    });

    test('reports the field even with a custom slug template', () => {
      check({ identifier_field: 'name', slug: '{{body}}' });
      expectInvalid('name');
    });

    test('leaves an option of the wrong type to the schema', () => {
      check({ identifier_field: 1 });
      check({ identifier_field: null });
      check({ identifier_field: ['title'] });
      expect(addMessage).not.toHaveBeenCalled();
    });
  });

  describe('without the identifier_field option', () => {
    test('says nothing when the collection has a title field', () => {
      check();
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('warns when the collection has no title field', () => {
      check({ fields: withoutTitle });
      expectMissing();
    });

    test('warns when entries can be created explicitly', () => {
      check({ fields: withoutTitle, create: true });
      expectMissing();
    });

    test('says nothing when entries can’t be created', () => {
      check({ fields: withoutTitle, create: false });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('says nothing with a custom slug template', () => {
      check({ fields: withoutTitle, slug: '{{name}}' });
      check({ fields: withoutTitle, slug: '{{uuid}}' });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('does not count a nested title field', () => {
      check({
        fields: [{ name: 'meta', widget: 'object', fields: [{ name: 'title', widget: 'string' }] }],
      });

      expectMissing();
    });
  });

  test('says nothing when the collection has no fields, which is reported separately', () => {
    check({ fields: undefined, identifier_field: 'name' });
    check({ fields: [], identifier_field: 'name' });
    check({ fields: [] });
    expect(addMessage).not.toHaveBeenCalled();
  });
});
