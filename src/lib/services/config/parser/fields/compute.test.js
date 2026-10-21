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

    test('warns about a field referring to itself by the index of an item', () => {
      check('{{fields.items.0.id}}-1');

      expect(addMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          strKey: 'compute_field_self_reference',
          values: { name: 'fields.items.0.id' },
        }),
      );
    });

    test('warns about a field referring to itself in a transformation argument', () => {
      check("{{fields.title | default('{{fields.items.*.id}}')}}-1");

      expect(addMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          strKey: 'compute_field_self_reference',
          values: { name: 'fields.items.*.id' },
        }),
      );
    });

    test('warns about a field adding itself up', () => {
      check('sum({{fields.items.*.id}})', {}, { value_type: 'int' });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ strKey: 'compute_field_self_reference' }),
      );
    });
  });

  describe('reference cycles', () => {
    /**
     * Get a Compute field configuration.
     * @param {string} name Field name.
     * @param {string} value The `value` option.
     * @param {string} [valueType] The `value_type` option.
     * @returns {any} Field configuration.
     */
    const compute = (name, value, valueType) => ({
      name,
      widget: 'compute',
      value,
      ...(valueType ? { value_type: valueType } : {}),
    });

    /**
     * Check a Compute field of a collection with the given fields.
     * @param {any[]} collectionFields Fields of the collection.
     * @param {string} typedKeyPath Typed key path of the field to check.
     * @returns {any} The context the check ran with.
     */
    const checkIn = (collectionFields, typedKeyPath) =>
      // The `value` of the checked field doesn’t matter: the cycles are found from the collection
      check('', {
        collection: { name: 'invoices', folder: 'content/invoices', fields: collectionFields },
        typedKeyPath,
      });

    /**
     * Get the cycle warnings reported so far.
     * @returns {any[]} `addMessage` arguments.
     */
    const getCycleWarnings = () =>
      vi
        .mocked(addMessage)
        .mock.calls.map(([args]) => args)
        .filter(({ strKey }) => strKey === 'compute_field_reference_cycle');

    test('reports a cycle of two fields once', () => {
      const cycleFields = [compute('a', '{{fields.b}}-a'), compute('b', '{{fields.a}}-b')];
      const context = checkIn(cycleFields, 'a');

      checkIn(cycleFields, 'b');

      expect(getCycleWarnings()).toEqual([
        {
          type: 'warning',
          strKey: 'compute_field_reference_cycle',
          values: { name: 'fields.b' },
          context,
          collectors,
        },
      ]);
    });

    test('reports a cycle of three fields once', () => {
      const cycleFields = [
        compute('c', '{{fields.a}} + 1', 'int'),
        compute('b', '{{fields.c}} + 1', 'int'),
        compute('a', '{{fields.b}} + 1', 'int'),
      ];

      ['a', 'b', 'c'].forEach((name) => checkIn(cycleFields, name));

      expect(getCycleWarnings()).toEqual([
        expect.objectContaining({ values: { name: 'fields.b' } }),
      ]);
      expect(getCycleWarnings()[0].context.typedKeyPath).toBe('a');
    });

    test('reports a cycle between a list item and the entry', () => {
      const cycleFields = [
        compute('total', 'sum({{fields.lines.*.amount}})', 'float'),
        {
          name: 'lines',
          widget: 'list',
          fields: [compute('amount', '{{fields.total}} / 2', 'float')],
        },
      ];

      checkIn(cycleFields, 'total');
      checkIn(cycleFields, 'lines.*.amount');

      expect(getCycleWarnings()).toEqual([
        expect.objectContaining({ values: { name: 'fields.total' } }),
      ]);
      expect(getCycleWarnings()[0].context.typedKeyPath).toBe('lines.*.amount');
    });

    test('finds the fields in objects, variable types and single-subfield lists', () => {
      const cycleFields = [
        compute('total', '{{fields.lines.0.amount}}-{{fields.meta.x}}-{{fields.tags.*}}'),
        {
          name: 'lines',
          widget: 'list',
          types: [{ name: 'product', fields: [compute('amount', '{{fields.total}}')] }],
        },
        {
          name: 'meta',
          widget: 'object',
          fields: [compute('x', '{{fields.meta.y}}')],
          types: [{ name: 'other', fields: [compute('y', '{{fields.meta.x}}')] }],
        },
        { name: 'tags', widget: 'list', field: compute('tag', '{{fields.total}}') },
        { name: 'notes', widget: 'list', fields: 'invalid' },
        null,
      ];

      ['total', 'lines.*<product>.amount', 'meta.x', 'meta<other>.y', 'tags.*'].forEach(
        (typedKeyPath) => checkIn(cycleFields, typedKeyPath),
      );

      expect(getCycleWarnings().map(({ context: { typedKeyPath } }) => typedKeyPath)).toEqual([
        'lines.*<product>.amount',
        'meta.x',
      ]);
    });

    test('follows a reference in a transformation argument', () => {
      const cycleFields = [
        compute('a', "{{fields.x | default('{{fields.b | upper}}')}}-a"),
        compute('b', '{{fields.a}}-b'),
      ];

      checkIn(cycleFields, 'a');

      expect(getCycleWarnings()).toEqual([
        expect.objectContaining({ values: { name: 'fields.b' } }),
      ]);
    });

    test('leaves a field adding up its own key path in every type to the self-reference check', () => {
      const typedFields = [
        {
          name: 'lines',
          widget: 'list',
          types: ['a', 'b'].map((name) => ({
            name,
            fields: [compute('amount', 'sum({{fields.lines.*.amount}})', 'int')],
          })),
        },
      ];

      checkIn(typedFields, 'lines.*<a>.amount');
      checkIn(typedFields, 'lines.*<b>.amount');

      expect(getCycleWarnings()).toEqual([]);
    });

    test('reports nothing for references without a cycle', () => {
      const chainFields = [
        compute('a', '{{fields.b}}'),
        compute('b', '{{fields.c}}'),
        compute('c', '{{fields.title}}-{{index}}'),
        compute('total', "sum({{fields.lines.*.amount}}) + {{fields.c | default('0')}}", 'int'),
        {
          name: 'lines',
          widget: 'list',
          fields: [compute('amount', '{{fields.lines.*.price}}', 'int'), { name: 'price' }],
        },
        compute('self', '{{fields.self}}-1'),
        compute('invalid', '{{fields.a}} +', 'int'),
        { name: 'other', widget: 'compute', value: 42 },
      ];

      ['a', 'b', 'c', 'total', 'lines.*.amount', 'self', 'invalid', 'other'].forEach(
        (typedKeyPath) => checkIn(chainFields, typedKeyPath),
      );

      expect(getCycleWarnings()).toEqual([]);
    });
  });
});
