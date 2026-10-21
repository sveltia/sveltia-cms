import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { applyTransformations } from '$lib/services/common/transformations';
import { getField } from '$lib/services/contents/entry/fields';
import { getFieldDisplayValue } from '$lib/services/contents/entry/values';
import {
  expandWildcards,
  formatComputedValue,
  getComputedValue,
  getListIndex,
  getNumericValue,
  hasUuidTag,
} from '$lib/services/contents/fields/compute/helpers';
import { expectLinearTime } from '$lib/test/complexity';

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));
vi.mock('$lib/services/contents/entry/values', () => ({
  getFieldDisplayValue: vi.fn(),
}));

/**
 * Get the arguments shared by the {@link getComputedValue} tests.
 * @param {string} value Value template.
 * @param {string} keyPath Key path of the field.
 * @returns {any} Arguments.
 */
const getArgs = (value, keyPath = 'slug') => ({
  fieldConfig: { name: 'slug', widget: 'compute', value },
  keyPath,
  locale: 'en',
  valueMap: {},
  collectionName: 'posts',
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_SHORT_REGEX = /^[0-9a-f]{12}$/;
const UUID_SHORTER_REGEX = /^[0-9a-f]{8}$/;

describe('hasUuidTag()', () => {
  test('should detect the UUID tags', () => {
    expect(hasUuidTag('{{uuid}}')).toBe(true);
    expect(hasUuidTag('{{uuid_short}}')).toBe(true);
    expect(hasUuidTag('{{uuid_shorter}}')).toBe(true);
    expect(hasUuidTag('{{fields.slug}}-{{ uuid_short | upper }}')).toBe(true);
  });

  test('should ignore other tags', () => {
    expect(hasUuidTag()).toBe(false);
    expect(hasUuidTag('')).toBe(false);
    expect(hasUuidTag('{{fields.uuid}}')).toBe(false);
    expect(hasUuidTag('{{index}}')).toBe(false);
    expect(hasUuidTag('uuid')).toBe(false);
  });
});

describe('getListIndex()', () => {
  test('should read the index from a list item key path', () => {
    expect(getListIndex('authors.0.slug')).toBe(0);
    expect(getListIndex('authors.12.slug')).toBe(12);
    expect(getListIndex('sections.1.authors.3.slug')).toBe(3);
  });

  test('should read the index of the item an Object field is in', () => {
    expect(getListIndex('lines.2.meta.n')).toBe(2);
    expect(getListIndex('sections.1.authors.3.meta.links.n')).toBe(3);
  });

  test('should read the index of a list item that is the field itself', () => {
    expect(getListIndex('lines.2')).toBe(2);
    expect(getListIndex('sections.1.tags.0')).toBe(0);
  });

  test('should return undefined outside a list item', () => {
    expect(getListIndex('slug')).toBeUndefined();
    expect(getListIndex('author.slug')).toBeUndefined();
  });
});

describe('getComputedValue()', () => {
  test('should return the index itself for a lone index template', () => {
    expect(getComputedValue(getArgs('{{index}}', 'authors.2.slug'))).toBe(2);
  });

  test('should resolve the index of the list item an Object field is in', () => {
    expect(getComputedValue(getArgs('{{index}}', 'lines.2.meta.n'))).toBe(2);
    expect(getComputedValue(getArgs('No. {{index}}', 'lines.2.meta.n'))).toBe('No. 2');
  });

  test('should return an empty string for a lone index template outside a list', () => {
    expect(getComputedValue(getArgs('{{index}}'))).toBe('');
  });

  test('should embed the index in a larger template', () => {
    expect(getComputedValue(getArgs('item-{{index}}', 'authors.2.slug'))).toBe('item-2');
    expect(getComputedValue(getArgs('item-{{index}}'))).toBe('item-');
  });

  test('should resolve a field tag', () => {
    vi.mocked(getFieldDisplayValue).mockReturnValue('Hello World');

    expect(getComputedValue(getArgs('posts-{{fields.title}}'))).toBe('posts-Hello World');

    expect(vi.mocked(getFieldDisplayValue)).toHaveBeenCalledWith(
      expect.objectContaining({ keyPath: 'title', collectionName: 'posts', locale: 'en' }),
    );
  });

  test('should format a list value', () => {
    vi.mocked(getFieldDisplayValue).mockReturnValue(/** @type {any} */ (['a', 'b']));

    expect(getComputedValue(getArgs('{{fields.tags}}'))).toBe('a, b');
  });

  test('should apply transformations', () => {
    vi.mocked(getFieldDisplayValue).mockReturnValue('Hello World');

    expect(getComputedValue(getArgs('{{fields.title | upper}}'))).toBe('HELLO WORLD');
  });

  test('should let the field apply transformations to its raw value', () => {
    // Stand in for `getFieldDisplayValue()`, which displays a boolean as `true` or `false` but
    // applies the transformations to the raw value
    vi.mocked(getFieldDisplayValue).mockImplementation(
      ({ valueMap = {}, keyPath, transformations }) =>
        transformations?.length
          ? String(
              applyTransformations({ value: valueMap[keyPath], transformations, locale: 'en' }),
            )
          : String(valueMap[keyPath]),
    );

    const args = getArgs("{{fields.draft | ternary('Draft', 'Live')}}");

    expect(getComputedValue({ ...args, valueMap: { draft: false } })).toBe('Live');
    expect(getComputedValue({ ...args, valueMap: { draft: true } })).toBe('Draft');

    expect(vi.mocked(getFieldDisplayValue)).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPath: 'draft',
        transformations: [expect.objectContaining({ method: 'ternary' })],
      }),
    );
  });

  test('should apply transformations to the display value of a value missing from the content', () => {
    // A List field’s value is stored under its item key paths, so the field itself has no value
    vi.mocked(getFieldDisplayValue).mockReturnValue('a, b');

    expect(getComputedValue(getArgs('{{fields.tags | upper}}'))).toBe('A, B');
    expect(vi.mocked(getFieldDisplayValue)).toHaveBeenCalledWith(
      expect.objectContaining({ keyPath: 'tags', transformations: undefined }),
    );

    // An unset field falls back to the default
    vi.mocked(getFieldDisplayValue).mockReturnValue('');

    expect(getComputedValue(getArgs("{{fields.title | default('Untitled')}}"))).toBe('Untitled');
  });

  test('should resolve the template tags in transformation arguments', () => {
    vi.mocked(getFieldDisplayValue).mockImplementation(
      ({ valueMap = {}, keyPath, transformations }) =>
        transformations?.length
          ? String(
              applyTransformations({ value: valueMap[keyPath], transformations, locale: 'en' }),
            )
          : String(valueMap[keyPath] ?? ''),
    );

    const valueMap = { title: 'Hello', first: 'Jane', last: 'Doe', draft: true };

    expect(
      getComputedValue({
        ...getArgs("{{fields.slug_override | default('{{fields.title | upper}}')}}"),
        valueMap,
      }),
    ).toBe('HELLO');
    expect(
      getComputedValue({
        ...getArgs("{{fields.name | default('{{fields.first}} {{fields.last}}')}}"),
        valueMap,
      }),
    ).toBe('Jane Doe');
    expect(
      getComputedValue({
        ...getArgs("{{fields.name | default('item-{{index}}')}}", 'authors.2.slug'),
        valueMap,
      }),
    ).toBe('item-2');
    expect(
      getComputedValue({
        ...getArgs("{{fields.draft | ternary('{{fields.first}}', '{{fields.last}}')}}"),
        valueMap,
      }),
    ).toBe('Jane');
  });

  test('should resolve a UUID tag in a transformation argument to nothing', () => {
    vi.mocked(getFieldDisplayValue).mockReturnValue('');

    // The UUID tag of the template itself still gets its UUID
    expect(getComputedValue(getArgs("{{fields.title | default('{{uuid}}')}}-{{uuid}}"))).toMatch(
      /^-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test('should return a stable empty slug for an empty source field', () => {
    // A random fallback would make the field recompute forever
    // @see https://github.com/sveltia/sveltia-cms/issues/946
    vi.mocked(getFieldDisplayValue).mockReturnValue('');

    expect(getComputedValue(getArgs('{{fields.title | slugify}}'))).toBe('');
    expect(getComputedValue(getArgs('{{fields.title | slugify}}'))).toBe('');
  });

  test('should ignore an unknown tag', () => {
    expect(getComputedValue(getArgs('a-{{unknown}}-b'))).toBe('a--b');
  });

  test('should return an empty string for a missing template', () => {
    expect(
      getComputedValue({ ...getArgs(''), fieldConfig: { name: 'slug', widget: 'compute' } }),
    ).toBe('');
  });

  describe('Number fields', () => {
    afterEach(() => {
      vi.mocked(getField).mockReset();
    });

    test('should insert a number as stored rather than formatted', () => {
      vi.mocked(getField).mockReturnValue({ name: 'sku', widget: 'number' });
      vi.mocked(getFieldDisplayValue).mockReturnValue('123,456');

      const args = { ...getArgs('/p/{{fields.sku}}'), valueMap: { sku: 123456 } };

      expect(getComputedValue(args)).toBe('/p/123456');
      expect(getFieldDisplayValue).not.toHaveBeenCalled();
      expect(getField).toHaveBeenCalledWith(
        expect.objectContaining({ collectionName: 'posts', keyPath: 'sku' }),
      );
    });

    test('should apply transformations to the stored number', () => {
      vi.mocked(getField).mockReturnValue({ name: 'sku', widget: 'number' });

      const args = { ...getArgs("{{fields.sku | default('none')}}"), valueMap: { sku: 1000 } };

      expect(getComputedValue(args)).toBe('1000');
      expect(getComputedValue({ ...args, valueMap: { sku: 0 } })).toBe('0');
      expect(getComputedValue({ ...args, valueMap: { sku: null } })).toBe('none');
    });

    test('should leave an empty number empty', () => {
      vi.mocked(getField).mockReturnValue({ name: 'sku', widget: 'number' });

      expect(getComputedValue({ ...getArgs('p-{{fields.sku}}'), valueMap: { sku: null } })).toBe(
        'p-',
      );
    });

    test('should keep the display value of another field type', () => {
      vi.mocked(getField).mockReturnValue({
        name: 'cat',
        widget: 'select',
        options: [{ label: 'Books', value: 'b' }],
      });
      vi.mocked(getFieldDisplayValue).mockReturnValue('Books');

      expect(getComputedValue({ ...getArgs('{{fields.cat}}'), valueMap: { cat: 'b' } })).toBe(
        'Books',
      );
    });
  });

  describe('Numeric value types', () => {
    /** @type {Record<string, any>} */
    const fieldMap = {
      price: { name: 'price', widget: 'number', value_type: 'float' },
      quantity: { name: 'quantity', widget: 'number' },
      title: { name: 'title', widget: 'string' },
      subtotal: { name: 'subtotal', widget: 'compute', value_type: 'float', value: '' },
      code: { name: 'code', widget: 'compute', value: '' },
    };

    /**
     * Get the arguments for a numeric Compute field.
     * @param {string} value Arithmetic expression.
     * @param {string} valueType Value type.
     * @param {Record<string, any>} valueMap Entry content.
     * @param {string} [keyPath] Key path of the field.
     * @returns {any} Arguments.
     */
    const getNumericArgs = (value, valueType, valueMap, keyPath = 'total') => ({
      ...getArgs(value, keyPath),
      fieldConfig: { name: 'total', widget: 'compute', value, value_type: valueType },
      valueMap,
    });

    afterEach(() => {
      vi.mocked(getField).mockReset();
    });

    test('should evaluate an arithmetic expression with the stored numbers', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => fieldMap[keyPath]);
      vi.mocked(getFieldDisplayValue).mockReturnValue('1,234.5');

      const valueMap = { price: 1234.5, quantity: 3 };
      const expression = '{{fields.price}} * {{fields.quantity}}';

      expect(getComputedValue(getNumericArgs(expression, 'float', valueMap))).toBe(3703.5);
      expect(getComputedValue(getNumericArgs(expression, 'float/string', valueMap))).toBe('3703.5');
      expect(getComputedValue(getNumericArgs(expression, 'int', valueMap))).toBe(3704);
      expect(getComputedValue(getNumericArgs(expression, 'int/string', valueMap))).toBe('3704');
      expect(getFieldDisplayValue).not.toHaveBeenCalled();
    });

    test('should leave the value empty if an operand is empty', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => fieldMap[keyPath]);

      const valueMap = { price: 10, quantity: null };
      const expression = '{{fields.price}} * {{fields.quantity}}';

      expect(getComputedValue(getNumericArgs(expression, 'int', valueMap))).toBeNull();
      expect(getComputedValue(getNumericArgs(expression, 'int/string', valueMap))).toBe('');
      expect(getComputedValue(getNumericArgs(expression, 'int', { price: 10 }))).toBeNull();
    });

    test('should let a transformation supply a value for an empty operand', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => fieldMap[keyPath]);

      const expression = "{{fields.price}} * {{fields.quantity | default('1')}}";

      expect(
        getComputedValue(getNumericArgs(expression, 'float', { price: 10, quantity: null })),
      ).toBe(10);
      expect(
        getComputedValue(getNumericArgs(expression, 'float', { price: 10, quantity: 0 })),
      ).toBe(0);
    });

    test('should use the stored number of another numeric Compute field', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => fieldMap[keyPath]);
      vi.mocked(getFieldDisplayValue).mockReturnValue('1,000');

      expect(
        getComputedValue(getNumericArgs('{{fields.subtotal}} * 1.1', 'float', { subtotal: 1000 })),
      ).toBe(1100);
      expect(getFieldDisplayValue).not.toHaveBeenCalled();
    });

    test('should use the display value of a string Compute field', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => fieldMap[keyPath]);
      vi.mocked(getFieldDisplayValue).mockReturnValue('42');

      expect(getComputedValue(getNumericArgs('{{fields.code}} + 1', 'int', { code: '42' }))).toBe(
        43,
      );
      expect(getFieldDisplayValue).toHaveBeenCalledOnce();
    });

    test('should use the stored value of a Select or Relation field', () => {
      /** @type {Record<string, any>} */
      const choiceFieldMap = {
        shipping: {
          name: 'shipping',
          widget: 'select',
          options: [
            { label: 'Standard', value: 0 },
            { label: 'Express', value: 5 },
          ],
        },
        'extras.0': { name: 'extras', widget: 'select', multiple: true, options: [1, 2, 3] },
        'extras.1': { name: 'extras', widget: 'select', multiple: true, options: [1, 2, 3] },
        weight: { name: 'weight', widget: 'relation', collection: 'sizes', value_field: 'kg' },
        qty: { name: 'qty', widget: 'number' },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => choiceFieldMap[keyPath]);
      vi.mocked(getFieldDisplayValue).mockReturnValue('');

      const valueMap = { shipping: 5, 'extras.0': 1, 'extras.1': 3, weight: '2.5', qty: 2 };

      expect(
        getComputedValue(getNumericArgs('{{fields.shipping}} + {{fields.qty}}', 'int', valueMap)),
      ).toBe(7);
      expect(getComputedValue(getNumericArgs('sum({{fields.extras.*}})', 'int', valueMap))).toBe(4);
      expect(getComputedValue(getNumericArgs('count({{fields.extras.*}})', 'int', valueMap))).toBe(
        2,
      );
      expect(
        getComputedValue(getNumericArgs('{{fields.weight}} * {{fields.qty}}', 'float', valueMap)),
      ).toBe(5);
      expect(getFieldDisplayValue).not.toHaveBeenCalled();
    });

    test('should leave the value empty for a field that isn’t a number', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => fieldMap[keyPath]);
      vi.mocked(getFieldDisplayValue).mockReturnValue('Hello');

      expect(
        getComputedValue(getNumericArgs('{{fields.title}} + 1', 'int', { title: 'Hello' })),
      ).toBeNull();
    });

    test('should use the index as a number', () => {
      expect(getComputedValue(getNumericArgs('{{index}} + 1', 'int', {}, 'items.2.total'))).toBe(3);
      expect(getComputedValue(getNumericArgs('{{index}}', 'int/string', {}, 'items.2.total'))).toBe(
        '2',
      );
      expect(getComputedValue(getNumericArgs('{{index}} + 1', 'int', {}))).toBeNull();
    });

    test('should not generate a UUID', () => {
      expect(getComputedValue(getNumericArgs('{{uuid}}', 'float', {}))).toBeNull();
      expect(getComputedValue(getNumericArgs('count({{uuid}})', 'int', {}))).toBe(0);
    });

    test('should leave the value empty for an invalid expression or an unknown tag', () => {
      expect(getComputedValue(getNumericArgs('1 +', 'float', {}))).toBeNull();
      expect(getComputedValue(getNumericArgs('{{title}} + 1', 'float', {}))).toBeNull();
    });

    test('should treat the `string` value type as a template', () => {
      expect(getComputedValue(getNumericArgs('1 + 1', 'string', {}))).toBe('1 + 1');
    });
  });

  describe('List items', () => {
    /** @type {Record<string, any>} */
    const fieldMap = {
      'lines.*.name': { name: 'name', widget: 'string' },
      'lines.*.price': { name: 'price', widget: 'number', value_type: 'float' },
      'lines.*.qty': { name: 'qty', widget: 'number' },
      'lines.*.amount': { name: 'amount', widget: 'compute', value_type: 'float', value: '' },
      'orders.*.lines.*.amount': { name: 'amount', widget: 'number' },
    };

    const valueMap = {
      'lines.0.name': 'Beans',
      'lines.0.price': 12.5,
      'lines.0.qty': 2,
      'lines.0.amount': 25,
      'lines.1.name': 'Filters',
      'lines.1.price': 4,
      'lines.1.qty': null,
      'lines.1.amount': null,
      'lines.2.name': '',
      'lines.2.price': 0.5,
      'lines.2.qty': 3,
      'lines.2.amount': 1.5,
      'orders.0.lines.0.amount': 1,
      'orders.0.lines.1.amount': 2,
      'orders.1.lines.0.amount': 10,
    };

    /**
     * Get the arguments for a Compute field.
     * @param {string} value Value template or arithmetic expression.
     * @param {string} keyPath Key path of the field.
     * @param {string} [valueType] Value type.
     * @returns {any} Arguments.
     */
    const getListArgs = (value, keyPath, valueType) => ({
      ...getArgs(value, keyPath),
      fieldConfig: { name: 'x', widget: 'compute', value, value_type: valueType },
      valueMap,
    });

    afterEach(() => {
      vi.mocked(getField).mockReset();
    });

    beforeEach(() => {
      vi.mocked(getField).mockImplementation(
        ({ keyPath }) => fieldMap[keyPath.replace(/\.\d+(?=\.|$)/g, '.*')],
      );
      vi.mocked(getFieldDisplayValue).mockImplementation(({ valueMap: map = {}, keyPath }) =>
        String(map[keyPath] ?? ''),
      );
    });

    test('should resolve a field of the current item in a template', () => {
      expect(getComputedValue(getListArgs('{{fields.lines.*.name}}!', 'lines.1.slug'))).toBe(
        'Filters!',
      );
    });

    test('should resolve a field of the current item in an arithmetic expression', () => {
      const expression = '{{fields.lines.*.price}} * {{fields.lines.*.qty}}';

      expect(getComputedValue(getListArgs(expression, 'lines.0.amount', 'float'))).toBe(25);
      expect(getComputedValue(getListArgs(expression, 'lines.1.amount', 'float'))).toBeNull();
    });

    test('should resolve a `*` without a current item to nothing', () => {
      expect(getComputedValue(getListArgs('[{{fields.lines.*.name}}]', 'title'))).toBe('[]');
      expect(
        getComputedValue(getListArgs('{{fields.lines.*.price}}', 'total', 'float')),
      ).toBeNull();
    });

    test('should aggregate every item of a list', () => {
      expect(
        getComputedValue(getListArgs('sum({{fields.lines.*.amount}})', 'total', 'float')),
      ).toBe(26.5);
      expect(getComputedValue(getListArgs('count({{fields.lines.*.name}})', 'total', 'int'))).toBe(
        2,
      );
      expect(
        getComputedValue(getListArgs("sum({{fields.lines.*.qty | default('1')}})", 'total', 'int')),
      ).toBe(6);
      expect(getComputedValue(getListArgs('max({{fields.lines.*.price}})', 'total', 'float'))).toBe(
        12.5,
      );
    });

    test('should aggregate every item from within an item', () => {
      const expression = 'round({{fields.lines.*.amount}} / sum({{fields.lines.*.amount}}) * 100)';

      expect(getComputedValue(getListArgs(expression, 'lines.2.share', 'int'))).toBe(6);
    });

    test('should aggregate the items of the current item of an outer list', () => {
      const expression = 'sum({{fields.orders.*.lines.*.amount}})';

      expect(getComputedValue(getListArgs(expression, 'orders.0.subtotal', 'int'))).toBe(3);
      expect(getComputedValue(getListArgs(expression, 'orders.1.subtotal', 'int'))).toBe(10);
      expect(getComputedValue(getListArgs(expression, 'total', 'int'))).toBe(13);
    });

    test('should aggregate the index and a field without a `*`', () => {
      expect(getComputedValue(getListArgs('sum({{index}}, 1)', 'lines.2.x', 'int'))).toBe(3);
      expect(
        getComputedValue(getListArgs('sum({{fields.lines.0.price}}, {{title}})', 'x', 'float')),
      ).toBe(12.5);
    });

    test('should aggregate an empty list', () => {
      expect(getComputedValue(getListArgs('sum({{fields.items.*.amount}})', 'total', 'int'))).toBe(
        0,
      );
    });
  });

  describe('Rich text editor component fields', () => {
    const componentFields = [{ name: 'heading' }, { name: 'meta', widget: 'object' }];

    /**
     * Get the arguments for a Compute field of a component instance.
     * @param {string} value Value template.
     * @returns {any} Arguments.
     */
    const getComponentArgs = (value) => ({
      ...getArgs(value, 'body:c1:anchor'),
      keyPathPrefix: 'body:c1:',
      valueMap: {
        'body:c1:__sc_component_name': 'section',
        'body:c1:heading': 'Intro',
        'body:c1:meta.label': 'Label',
        'body:c2:__sc_component_name': 'section',
        'body:c2:heading': 'Other',
      },
      entryValueMap: { title: 'Hello', heading: 'Entry heading' },
    });

    afterEach(() => {
      vi.mocked(getField).mockReset();
    });

    test('should resolve a field of the component', () => {
      vi.mocked(getField).mockImplementation(({ componentName, keyPath }) =>
        componentName === 'section'
          ? componentFields.find(({ name }) => name === keyPath.split('.')[0])
          : undefined,
      );
      vi.mocked(getFieldDisplayValue).mockImplementation(
        ({ valueMap = {}, keyPath }) => valueMap[keyPath],
      );

      expect(getComputedValue(getComponentArgs('#{{fields.heading}}'))).toBe('#Intro');
      expect(getComputedValue(getComponentArgs('{{fields.heading}}/{{fields.meta.label}}'))).toBe(
        'Intro/Label',
      );
      expect(getFieldDisplayValue).toHaveBeenCalledWith(
        expect.objectContaining({
          componentName: 'section',
          keyPath: 'heading',
          valueMap: {
            __sc_component_name: 'section',
            heading: 'Intro',
            'meta.label': 'Label',
          },
        }),
      );
    });

    test('should fall back to a field of the entry', () => {
      vi.mocked(getField).mockImplementation(({ componentName, keyPath }) =>
        componentName === 'section'
          ? componentFields.find(({ name }) => name === keyPath)
          : undefined,
      );
      vi.mocked(getFieldDisplayValue).mockImplementation(
        ({ valueMap = {}, keyPath }) => valueMap[keyPath],
      );

      expect(getComputedValue(getComponentArgs('{{fields.title}}'))).toBe('Hello');
      expect(getFieldDisplayValue).toHaveBeenCalledWith(
        expect.objectContaining({
          componentName: undefined,
          keyPath: 'title',
          valueMap: { title: 'Hello', heading: 'Entry heading' },
        }),
      );
    });

    test('should resolve the template tags in transformation arguments the same way', () => {
      vi.mocked(getField).mockImplementation(({ componentName, keyPath }) =>
        componentName === 'section'
          ? componentFields.find(({ name }) => name === keyPath)
          : undefined,
      );
      vi.mocked(getFieldDisplayValue).mockImplementation(
        ({ valueMap = {}, keyPath }) => valueMap[keyPath] ?? '',
      );

      expect(
        getComputedValue(
          getComponentArgs("{{fields.anchor | default('{{fields.heading}}-{{fields.title}}')}}"),
        ),
      ).toBe('Intro-Hello');
    });

    test('should insert a number of the component as stored', () => {
      vi.mocked(getField).mockReturnValue({ name: 'count', widget: 'number' });

      const args = getComponentArgs('n-{{fields.count}}');

      args.valueMap['body:c1:count'] = 1500;

      expect(getComputedValue(args)).toBe('n-1500');
    });

    test('should resolve a field of the current item of the component or the entry', () => {
      vi.mocked(getField).mockImplementation(({ componentName, keyPath }) =>
        componentName
          ? keyPath.startsWith('slides.')
            ? { name: 'caption' }
            : undefined
          : { name: 'name' },
      );
      vi.mocked(getFieldDisplayValue).mockImplementation(
        ({ valueMap = {}, keyPath }) => valueMap[keyPath],
      );

      const args = {
        ...getArgs(
          '{{fields.slides.*.caption}}/{{fields.lines.*.name}}',
          'lines.1.body:c1:slides.0.id',
        ),
        keyPathPrefix: 'lines.1.body:c1:',
        valueMap: {
          'lines.1.body:c1:__sc_component_name': 'section',
          'lines.1.body:c1:slides.0.caption': 'Hello',
        },
        entryValueMap: { 'lines.0.name': 'Beans', 'lines.1.name': 'Filters' },
      };

      expect(getComputedValue(args)).toBe('Hello/Filters');
    });

    test('should look up the entry’s fields for a component without a name', () => {
      vi.mocked(getFieldDisplayValue).mockImplementation(
        ({ valueMap = {}, keyPath }) => valueMap[keyPath],
      );

      const args = getComponentArgs('{{fields.heading}}');

      delete args.valueMap['body:c1:__sc_component_name'];

      expect(getComputedValue(args)).toBe('Entry heading');
      expect(getField).not.toHaveBeenCalledWith(
        expect.objectContaining({ componentName: 'section' }),
      );
    });

    test('should resolve an entry field against an empty map without the entry content', () => {
      vi.mocked(getFieldDisplayValue).mockReturnValue('');

      const { entryValueMap: _entryValueMap, ...args } = getComponentArgs('{{fields.title}}');

      expect(getComputedValue(args)).toBe('');
    });
  });

  describe('UUID tags', () => {
    test('should generate a UUID of each length', () => {
      expect(getComputedValue(getArgs('{{uuid}}'))).toMatch(UUID_REGEX);
      expect(getComputedValue(getArgs('{{uuid_short}}'))).toMatch(UUID_SHORT_REGEX);
      expect(getComputedValue(getArgs('{{uuid_shorter}}'))).toMatch(UUID_SHORTER_REGEX);
    });

    test('should keep the UUID found in the current value', () => {
      const valueMap = { slug: 'de305d54-75b4-431b-adb2-eb6b9e546014' };

      expect(getComputedValue({ ...getArgs('{{uuid}}'), valueMap })).toBe(valueMap.slug);
    });

    test('should keep the UUIDs found in the current value around other tags', () => {
      vi.mocked(getFieldDisplayValue).mockReturnValue('hello');

      const valueMap = { slug: 'hello-ab12cd34-eb6b9e546014' };

      expect(
        getComputedValue({
          ...getArgs('{{fields.title}}-{{uuid_shorter}}-{{uuid_short}}'),
          valueMap,
        }),
      ).toBe(valueMap.slug);

      // The other tags may have changed since the value was resolved
      vi.mocked(getFieldDisplayValue).mockReturnValue('hello world');

      expect(
        getComputedValue({
          ...getArgs('{{fields.title}}-{{uuid_shorter}}-{{uuid_short}}'),
          valueMap,
        }),
      ).toBe('hello world-ab12cd34-eb6b9e546014');
    });

    test('should keep a transformed UUID found in the current value', () => {
      const valueMap = { slug: 'id-EB6B9E546014' };

      expect(getComputedValue({ ...getArgs('id-{{uuid_short | upper}}'), valueMap })).toBe(
        valueMap.slug,
      );
    });

    test('should ignore a current value the template can’t have resolved to', () => {
      // Too short for the tag
      const valueMap = { slug: 'ab12cd34' };
      const value = getComputedValue({ ...getArgs('{{uuid_short}}'), valueMap });

      expect(value).toMatch(UUID_SHORT_REGEX);
      expect(value).not.toBe(valueMap.slug);
    });

    test('should not be fooled by a literal that looks like a UUID', () => {
      vi.mocked(getFieldDisplayValue).mockReturnValue('');

      // Only the last segment can be the UUID, so the value is kept as is
      const valueMap = { slug: 'ab12cd34-{{fields.title}}-ef56ab78' };
      const args = getArgs('ab12cd34-{{fields.title}}-{{uuid_shorter}}');

      expect(getComputedValue({ ...args, valueMap })).toBe('ab12cd34--ef56ab78');
    });

    test('should reuse the UUID generated for the field in the same content', () => {
      const valueMap = { slug: '' };
      const args = getArgs('{{uuid}}');
      const value = /** @type {string} */ (getComputedValue({ ...args, valueMap }));

      expect(value).toMatch(UUID_REGEX);
      // The value hasn’t been written back yet
      expect(getComputedValue({ ...args, valueMap })).toBe(value);
      // The value has been written back, so it’s read from there
      valueMap.slug = value;
      expect(getComputedValue({ ...args, valueMap })).toBe(value);
    });

    test('should keep a UUID stable while a transformation alters its shape', () => {
      const valueMap = { slug: '' };
      const args = getArgs("{{uuid | truncate(4, '-')}}");
      const value = /** @type {string} */ (getComputedValue({ ...args, valueMap }));

      expect(value).toMatch(/^[0-9a-f]{4}-$/);
      valueMap.slug = value;
      // The value can’t be recognized as a UUID, but the generated one is remembered
      expect(getComputedValue({ ...args, valueMap })).toBe(value);
    });

    test('should generate new UUIDs for a different field or content', () => {
      const valueMap = { slug: '', id: '' };
      const args = getArgs('{{uuid}}');
      const value = getComputedValue({ ...args, valueMap });

      expect(getComputedValue({ ...args, valueMap, keyPath: 'id' })).not.toBe(value);
      expect(getComputedValue({ ...args, valueMap: { slug: '' } })).not.toBe(value);
    });

    test('should generate new UUIDs when the template changes the number of tags', () => {
      const valueMap = { slug: '' };

      const value = /** @type {string} */ (
        getComputedValue({ ...getArgs('{{uuid_short}}'), valueMap })
      );

      const nextValue = /** @type {string} */ (
        getComputedValue({ ...getArgs('{{uuid_short}}-{{uuid_short}}'), valueMap })
      );

      expect(nextValue).toMatch(/^[0-9a-f]{12}-[0-9a-f]{12}$/);
      expect(nextValue.startsWith(value)).toBe(false);
    });

    test('should read a UUID next to another tag at either edge of the template', () => {
      // The neighbour’s value is made of hexadecimal characters, which can’t be mistaken for the
      // UUID as the UUID is known to be the last, or first, characters of the value
      vi.mocked(getFieldDisplayValue).mockReturnValue('1');

      const valueMap = { slug: '1abcdef12' };

      expect(getComputedValue({ ...getArgs('{{fields.a}}{{uuid_shorter}}'), valueMap })).toBe(
        '1abcdef12',
      );

      valueMap.slug = 'abcdef121';

      expect(getComputedValue({ ...getArgs('{{uuid_shorter}}{{fields.a}}'), valueMap })).toBe(
        'abcdef121',
      );
    });

    test('should not read a UUID sitting between other tags', () => {
      // The UUID could start anywhere in a run of hexadecimal characters, so reading it back could
      // shift it on every resolution. The generated one is used instead
      vi.mocked(getFieldDisplayValue).mockReturnValueOnce('1').mockReturnValueOnce('f');

      const valueMap = { slug: '1abcdef12f' };
      const args = getArgs('{{fields.a}}{{uuid_shorter}}{{fields.b}}');
      const value = /** @type {string} */ (getComputedValue({ ...args, valueMap }));

      expect(value).toMatch(/^1[0-9a-f]{8}f$/);
      expect(value).not.toBe(valueMap.slug);

      // The generated UUID is stable from then on
      vi.mocked(getFieldDisplayValue).mockReturnValueOnce('1').mockReturnValueOnce('f');
      valueMap.slug = value;
      expect(getComputedValue({ ...args, valueMap })).toBe(value);
    });

    test('should still read the UUIDs at the edges around a UUID sitting between other tags', () => {
      vi.mocked(getFieldDisplayValue).mockReturnValue('x');

      const valueMap = { slug: 'ab12cd34-x-ef56ab78-x-eb6b9e546014' };

      const args = getArgs(
        '{{uuid_shorter}}-{{fields.a}}-{{uuid_shorter}}-{{fields.b}}-{{uuid_short}}',
      );

      const value = /** @type {string} */ (getComputedValue({ ...args, valueMap }));

      expect(value).toMatch(/^ab12cd34-x-[0-9a-f]{8}-x-eb6b9e546014$/);
      expect(value).not.toBe(valueMap.slug);
    });

    test('should reject a long value that doesn’t match in linear time', () => {
      // A wildcard per tag would make the time grow with the cube of the length
      vi.mocked(getFieldDisplayValue).mockReturnValue('x');

      const args = getArgs('{{fields.a}}-{{fields.b}}-{{fields.c}}-{{uuid_shorter}}');

      expect(getComputedValue({ ...args, valueMap: { slug: 'ab-'.repeat(100) } })).toMatch(
        /^x-x-x-[0-9a-f]{8}$/,
      );
      expectLinearTime(
        (n) => ({ slug: 'ab-'.repeat(n) }),
        (valueMap) => getComputedValue({ ...args, valueMap }),
        200,
      );
    });

    test('should ignore a non-string current value', () => {
      expect(getComputedValue({ ...getArgs('{{uuid}}'), valueMap: { slug: 42 } })).toMatch(
        UUID_REGEX,
      );
    });
  });
});

describe('getNumericValue()', () => {
  /**
   * Get a Compute field configuration with the given value type.
   * @param {string} valueType Value type.
   * @returns {any} Field configuration.
   */
  const config = (valueType) => ({
    name: 'total',
    widget: 'compute',
    value: '',
    value_type: valueType,
  });

  test('should round a floating-point result to 15 significant digits', () => {
    expect(getNumericValue(0.1 * 3, config('float'))).toBe(0.3);
    expect(getNumericValue(0.1 + 0.2, config('float/string'))).toBe('0.3');
    expect(getNumericValue(1 / 3, config('float'))).toBe(0.333333333333333);
  });

  test('should round an integer result to the nearest integer', () => {
    expect(getNumericValue(2.5, config('int'))).toBe(3);
    expect(getNumericValue(2.4, config('int/string'))).toBe('2');
  });

  test('should turn negative zero into zero', () => {
    expect(Object.is(getNumericValue(-0, config('float')), 0)).toBe(true);
    expect(Object.is(getNumericValue(-0.4, config('int')), 0)).toBe(true);
    expect(getNumericValue(-0, config('float/string'))).toBe('0');
  });

  test('should leave a missing result empty', () => {
    expect(getNumericValue(undefined, config('float'))).toBeNull();
    expect(getNumericValue(undefined, config('int'))).toBeNull();
    expect(getNumericValue(undefined, config('float/string'))).toBe('');
    expect(getNumericValue(undefined, config('int/string'))).toBe('');
  });

  test('should leave an integer beyond the safe range empty', () => {
    expect(getNumericValue(2 ** 53, config('int'))).toBeNull();
    expect(getNumericValue(2 ** 53, config('int/string'))).toBe('');
    expect(getNumericValue(2 ** 53, config('float'))).toBe(2 ** 53);
  });

  test('should treat a custom value type like `int/string`, as a Number field does', () => {
    expect(getNumericValue(2.5, config('custom'))).toBe('3');
    expect(getNumericValue(undefined, config('custom'))).toBe('');
  });

  test('should keep every digit of a large integer result of a floating-point type', () => {
    expect(getNumericValue(1234567890123456, config('float'))).toBe(1234567890123456);
    expect(getNumericValue(1e21, config('float/string'))).toBe('1e+21');
  });
});

describe('formatComputedValue()', () => {
  const numericConfig = /** @type {any} */ ({ widget: 'compute', value: '', value_type: 'float' });
  const stringConfig = /** @type {any} */ ({ widget: 'compute', value: '' });

  test('should format a number like a Number field value', () => {
    expect(
      formatComputedValue({ value: 1234.5, fieldConfig: numericConfig, canonicalLocale: 'en' }),
    ).toBe('1,234.5');
    expect(
      formatComputedValue({ value: '1234.5', fieldConfig: numericConfig, canonicalLocale: 'de' }),
    ).toBe('1.234,5');
  });

  test('should leave an empty value empty', () => {
    [null, undefined, '', ' '].forEach((value) => {
      expect(
        formatComputedValue({ value, fieldConfig: numericConfig, canonicalLocale: 'en' }).trim(),
      ).toBe('');
    });
  });

  test('should return a value that isn’t a number as is', () => {
    expect(
      formatComputedValue({ value: 'abc', fieldConfig: numericConfig, canonicalLocale: 'en' }),
    ).toBe('abc');
  });

  test('should not format the value of a string Compute field', () => {
    expect(
      formatComputedValue({ value: 1234, fieldConfig: stringConfig, canonicalLocale: 'en' }),
    ).toBe('1234');
    expect(
      formatComputedValue({ value: undefined, fieldConfig: stringConfig, canonicalLocale: 'en' }),
    ).toBe('');
  });
});

describe('expandWildcards()', () => {
  const valueMap = {
    'a.0.b': 1,
    'a.2.b': 2,
    'a.1.c.0.d': 3,
    'a.1.c.1.d': 4,
    'a.2.c.0.d': 5,
  };

  test('should return a key path without a wildcard as is', () => {
    expect(
      expandWildcards({ fieldKeyPath: 'a.0.b', ownKeyPath: 'x', allItems: false, valueMap }),
    ).toEqual(['a.0.b']);
  });

  test('should resolve a wildcard to the current item', () => {
    expect(
      expandWildcards({ fieldKeyPath: 'a.*.b', ownKeyPath: 'a.2.x', allItems: false, valueMap }),
    ).toEqual(['a.2.b']);
    expect(
      expandWildcards({
        fieldKeyPath: 'a.*.c.*.d',
        ownKeyPath: 'a.1.c.0.e',
        allItems: false,
        valueMap,
      }),
    ).toEqual(['a.1.c.0.d']);
  });

  test('should return nothing for a wildcard without a current item', () => {
    [
      ['a.*.b', 'x'],
      ['a.*.b', 'b.0.x'],
      ['a.*.b', 'a.x'],
      ['a.*.c.*.d', 'a.1.x'],
    ].forEach(([fieldKeyPath, ownKeyPath]) => {
      expect(expandWildcards({ fieldKeyPath, ownKeyPath, allItems: false, valueMap })).toEqual([]);
    });
  });

  test('should expand the last wildcard to every item for an aggregate function', () => {
    expect(
      expandWildcards({ fieldKeyPath: 'a.*.b', ownKeyPath: 'x', allItems: true, valueMap }),
    ).toEqual(['a.0.b', 'a.1.b', 'a.2.b']);
    expect(
      expandWildcards({ fieldKeyPath: 'a.*.b', ownKeyPath: 'a.0.x', allItems: true, valueMap }),
    ).toEqual(['a.0.b', 'a.1.b', 'a.2.b']);
    expect(
      expandWildcards({ fieldKeyPath: 'a.*.c.*.d', ownKeyPath: 'a.1.x', allItems: true, valueMap }),
    ).toEqual(['a.1.c.0.d', 'a.1.c.1.d']);
    expect(
      expandWildcards({ fieldKeyPath: 'a.*.c.*.d', ownKeyPath: 'x', allItems: true, valueMap }),
    ).toEqual(['a.1.c.0.d', 'a.1.c.1.d', 'a.2.c.0.d']);
    expect(
      expandWildcards({ fieldKeyPath: 'z.*.b', ownKeyPath: 'x', allItems: true, valueMap }),
    ).toEqual([]);
  });
});
