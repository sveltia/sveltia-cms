import { afterEach, describe, expect, test, vi } from 'vitest';

import { applyTransformations } from '$lib/services/common/transformations';
import { getField } from '$lib/services/contents/entry/fields';
import { getFieldDisplayValue } from '$lib/services/contents/entry/values';
import {
  getComputedValue,
  getListIndex,
  hasUuidTag,
} from '$lib/services/contents/fields/compute/helpers';

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

  test('should return undefined outside a list item', () => {
    expect(getListIndex('slug')).toBeUndefined();
    expect(getListIndex('author.slug')).toBeUndefined();
  });
});

describe('getComputedValue()', () => {
  test('should return the index itself for a lone index template', () => {
    expect(getComputedValue(getArgs('{{index}}', 'authors.2.slug'))).toBe(2);
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
      // A wildcard per tag would make this take minutes
      vi.mocked(getFieldDisplayValue).mockReturnValue('x');

      const valueMap = { slug: 'ab-'.repeat(10_000) };
      const args = getArgs('{{fields.a}}-{{fields.b}}-{{fields.c}}-{{uuid_shorter}}');
      const start = performance.now();

      expect(getComputedValue({ ...args, valueMap })).toMatch(/^x-x-x-[0-9a-f]{8}$/);
      expect(performance.now() - start).toBeLessThan(1000);
    });

    test('should ignore a non-string current value', () => {
      expect(getComputedValue({ ...getArgs('{{uuid}}'), valueMap: { slug: 42 } })).toMatch(
        UUID_REGEX,
      );
    });
  });
});
