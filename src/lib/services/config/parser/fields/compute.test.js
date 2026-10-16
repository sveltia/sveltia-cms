import { beforeEach, describe, expect, test, vi } from 'vitest';

import { parseComputeFieldConfig } from '$lib/services/config/parser/fields/compute';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/** @type {any[]} */
const fields = [
  { name: 'title', widget: 'string' },
  {
    name: 'items',
    widget: 'list',
    fields: [
      { name: 'name', widget: 'string' },
      { name: 'id', widget: 'compute', value: '' },
    ],
  },
];

/**
 * Parse a Compute field with the given value template in the given context.
 * @param {any} value The `value` option.
 * @param {object} [contextOverrides] Context to override the collection context with.
 * @param {object} [configOverrides] Options to add to the field configuration.
 * @returns {any} The context the check ran with.
 */
const check = (value, contextOverrides = {}, configOverrides = {}) => {
  const context = {
    cmsConfig: {},
    collection: { name: 'posts', folder: 'content/posts', fields },
    typedKeyPath: 'items.*.id',
    ...contextOverrides,
  };

  parseComputeFieldConfig({
    config: /** @type {any} */ ({ name: 'id', widget: 'compute', value, ...configOverrides }),
    context: /** @type {any} */ (context),
    collectors,
  });

  return context;
};

describe('parseComputeFieldConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('accepts prefixed tags that name fields of the entry', () => {
    check('posts-{{fields.title}}-{{fields.items.*.name}}');
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('ignores the index tag and other bare tags, which never read a field', () => {
    check('{{index}}-{{title}}-{{slug}}');
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports a prefixed tag that names no field', () => {
    const context = check('posts-{{fields.slug}}');

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'option_field_not_found',
      values: { option: 'value', name: 'fields.slug' },
      context,
      collectors,
    });
  });

  test('checks against the fields of a collection file', () => {
    check('{{fields.title}}', {
      collection: { name: 'settings', files: [] },
      collectionFile: { name: 'general', file: 'general.yaml', fields: [{ name: 'siteName' }] },
    });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ values: { option: 'value', name: 'fields.title' } }),
    );
  });

  test('checks against the fields of an index file when it has its own', () => {
    check('{{fields.title}}', {
      collection: {
        name: 'posts',
        folder: 'content/posts',
        fields,
        index_file: { fields: [{ name: 'heading' }] },
      },
      isIndexFile: true,
    });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ values: { option: 'value', name: 'fields.title' } }),
    );
  });

  test('says nothing for a field of a custom editor component', () => {
    check('{{fields.slug}}', { collection: undefined, componentName: 'my-component' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('says nothing when the collection has no fields, which is reported separately', () => {
    check('{{fields.slug}}', {
      collection: { name: 'posts', folder: 'content/posts', fields: [] },
    });
    expect(addMessage).not.toHaveBeenCalled();
  });

  describe('numeric value types', () => {
    test('accepts a valid arithmetic expression', () => {
      check('{{fields.title}} * 2 + {{index}}', {}, { value_type: 'float' });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('reports an invalid arithmetic expression', () => {
      const context = check('posts-{{fields.title}}', {}, { value_type: 'int' });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'compute_field_invalid_expression',
        values: { valueType: 'int' },
        context,
        collectors,
      });
    });

    test('reports a UUID tag in an arithmetic expression', () => {
      const context = check('{{uuid_short | upper}} + 1', {}, { value_type: 'float/string' });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'compute_field_uuid_in_expression',
        values: { valueType: 'float/string' },
        context,
        collectors,
      });
    });

    test('still checks the field references', () => {
      check('{{fields.slug}} + 1', {}, { value_type: 'int' });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ strKey: 'option_field_not_found' }),
      );
    });

    test('checks no expression for the `string` value type', () => {
      check('posts-{{fields.title}}', {}, { value_type: 'string' });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('leaves a `value` that isn’t a string to the JSON schema', () => {
      check(42, {}, { value_type: 'int' });
      expect(addMessage).not.toHaveBeenCalled();
    });
  });

  describe('wildcards', () => {
    test('accepts a `*` standing for an item the field is in', () => {
      check('{{fields.items.*.id}}-{{fields.title}}', { typedKeyPath: 'items.*.slug' });
      check('{{fields.items.*.id}}', { typedKeyPath: 'items.*<product>.slug' });
      check('{{fields.items.*.id}} + 1', { typedKeyPath: 'items.*.slug' }, { value_type: 'int' });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('accepts a `*` passed to an aggregate function', () => {
      check('sum({{fields.items.*.id}})', { typedKeyPath: 'total' }, { value_type: 'int' });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('warns about a `*` standing for no item the field is in', () => {
      const context = check('{{fields.items.*.id}}', { typedKeyPath: 'total' });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith({
        type: 'warning',
        strKey: 'compute_field_wildcard_without_item',
        values: { name: 'fields.items.*.id' },
        context,
        collectors,
      });
    });

    test('warns about a `*` outside an aggregate function in an arithmetic expression', () => {
      check('{{fields.items.*.id}} + 1', { typedKeyPath: 'total' }, { value_type: 'int' });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ strKey: 'compute_field_wildcard_without_item' }),
      );
    });

    test('checks no wildcard of a field of a custom editor component', () => {
      check('{{fields.items.*.id}}', { collection: undefined, componentName: 'my-component' });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('checks no wildcard of an invalid arithmetic expression, which is reported instead', () => {
      check('{{fields.items.*.id}} +', { typedKeyPath: 'total' }, { value_type: 'int' });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ strKey: 'compute_field_invalid_expression' }),
      );
    });

    test('ignores the tags other than field references', () => {
      check('{{index}}-{{uuid}}', { typedKeyPath: undefined });
      expect(addMessage).not.toHaveBeenCalled();
    });
  });

  describe('self-references', () => {
    test('warns about a field referring to itself', () => {
      const context = check('{{fields.items.*.id}}-1');

      expect(addMessage).toHaveBeenCalledExactlyOnceWith({
        type: 'warning',
        strKey: 'compute_field_self_reference',
        values: { name: 'fields.items.*.id' },
        context,
        collectors,
      });
    });

    test('warns about a field adding itself up', () => {
      check('sum({{fields.items.*.id}})', {}, { value_type: 'int' });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ strKey: 'compute_field_self_reference' }),
      );
    });
  });
});
