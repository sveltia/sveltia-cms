import { describe, expect, test, vi } from 'vitest';

import {
  GET_DEFAULT_VALUE_MAP_FUNCTIONS,
  getDefaultValues,
  populateDefaultValue,
} from './defaults';

/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

// Mock the field helper modules
vi.mock('$lib/services/contents/fields/boolean/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue === 'true' ? true : (fieldConfig.default ?? false),
  })),
}));

vi.mock('$lib/services/contents/fields/code/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue || fieldConfig.default || '',
  })),
}));

vi.mock('$lib/services/contents/fields/date-time/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue || fieldConfig.default || '',
  })),
}));

vi.mock('$lib/services/contents/fields/hidden/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue || fieldConfig.default || '',
  })),
}));

vi.mock('$lib/services/contents/fields/key-value/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue || fieldConfig.default || {},
  })),
}));

vi.mock('$lib/services/contents/fields/list/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue || fieldConfig.default || [],
  })),
}));

vi.mock('$lib/services/contents/fields/markdown/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue || fieldConfig.default || '',
  })),
}));

vi.mock('$lib/services/contents/fields/number/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue ? parseFloat(dynamicValue) : (fieldConfig.default ?? 0),
  })),
}));

vi.mock('$lib/services/contents/fields/object/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue || fieldConfig.default || {},
  })),
}));

vi.mock('$lib/services/contents/fields/select/defaults', () => ({
  // eslint-disable-next-line no-unused-vars
  getDefaultValueMap: vi.fn(({ keyPath, fieldConfig, _locale, _defaultLocale, dynamicValue }) => ({
    [keyPath]: dynamicValue || fieldConfig.default || '',
  })),
}));

describe('Test populateDefaultValue()', () => {
  test('should set empty string for compute field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'computed_field',
      widget: 'compute',
      value: '{{title}}-{{date}}',
      default: 'should be ignored',
    };

    populateDefaultValue({
      content,
      keyPath: 'computed_field',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content).toEqual({
      computed_field: '',
    });
  });

  test('should ignore dynamic values and default for compute field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'computed_field',
      widget: 'compute',
      value: '{{author}}-{{year}}',
      default: 'default value',
    };

    populateDefaultValue({
      content,
      keyPath: 'computed_field',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: { computed_field: 'dynamic value' },
    });

    expect(content).toEqual({
      computed_field: '',
    });
  });

  test('should use dynamic value when available and not array-like', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'title',
      widget: 'string',
      default: 'Default Title',
    };

    populateDefaultValue({
      content,
      keyPath: 'title',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: { title: 'Dynamic Title' },
    });

    expect(content.title).toBe('Dynamic Title');
  });

  test('should ignore dynamic value for array-like key paths', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'tags',
      widget: 'string',
      default: 'Default Tag',
    };

    populateDefaultValue({
      content,
      keyPath: 'tags.0',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: { 'tags.0': 'Dynamic Tag' },
    });

    expect(content['tags.0']).toBe('Default Tag');
  });

  test('should ignore dynamic value for nested array-like key paths', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'items',
      widget: 'string',
      default: 'Default Item',
    };

    populateDefaultValue({
      content,
      keyPath: 'items.0.name',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: { 'items.0.name': 'Dynamic Item' },
    });

    expect(content['items.0.name']).toBe('Default Item');
  });

  test('should use trimmed dynamic value when non-empty', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'title',
      widget: 'string',
      default: 'Default Title',
    };

    populateDefaultValue({
      content,
      keyPath: 'title',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: { title: '  Trimmed Title  ' },
    });

    expect(content.title).toBe('Trimmed Title');
  });

  test('should use default value when dynamic value is empty after trimming', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'title',
      widget: 'string',
      default: 'Default Title',
    };

    populateDefaultValue({
      content,
      keyPath: 'title',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: { title: '   ' },
    });

    expect(content.title).toBe('Default Title');
  });

  test('should use field-specific default value map for boolean field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'published',
      widget: 'boolean',
      default: true,
    };

    populateDefaultValue({
      content,
      keyPath: 'published',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content.published).toBe(true);
  });

  test('should use field-specific default value map for number field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'rating',
      widget: 'number',
      default: 5,
    };

    populateDefaultValue({
      content,
      keyPath: 'rating',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content.rating).toBe(5);
  });

  test('should use field-specific default value map for list field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'tags',
      widget: 'list',
      default: ['tag1', 'tag2'],
    };

    populateDefaultValue({
      content,
      keyPath: 'tags',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content.tags).toEqual(['tag1', 'tag2']);
  });

  test('should use field-specific default value map for object field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'author',
      widget: 'object',
      default: { name: 'John Doe', email: 'john@example.com' },
    };

    populateDefaultValue({
      content,
      keyPath: 'author',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content.author).toEqual({ name: 'John Doe', email: 'john@example.com' });
  });

  test('should use field-specific default value map for select field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'category',
      widget: 'select',
      default: 'technology',
      options: ['technology', 'health', 'finance'],
    };

    populateDefaultValue({
      content,
      keyPath: 'category',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content.category).toBe('technology');
  });

  test('should use field-specific default value map for relation field (alias for select)', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'related_post',
      widget: 'relation',
      default: 'post-1',
      collection: 'posts',
      search_fields: ['title'],
      value_field: 'slug',
    };

    populateDefaultValue({
      content,
      keyPath: 'related_post',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content.related_post).toBe('post-1');
  });

  test('should handle unknown field types as string fields', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'custom_field',
      widget: 'custom',
      default: 'Custom Default',
    };

    populateDefaultValue({
      content,
      keyPath: 'custom_field',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content.custom_field).toBe('Custom Default');
  });

  test('should use empty string for unknown field without default', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'custom_field',
      widget: 'custom',
    };

    populateDefaultValue({
      content,
      keyPath: 'custom_field',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content.custom_field).toBe('');
  });

  test('should default to string field when `widget` is not specified', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'title',
      default: 'Default Title',
    };

    populateDefaultValue({
      content,
      keyPath: 'title',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(content.title).toBe('Default Title');
  });

  test('should handle dynamic value with boolean field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'published',
      widget: 'boolean',
      default: false,
    };

    populateDefaultValue({
      content,
      keyPath: 'published',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: { published: 'true' },
    });

    expect(content.published).toBe(true);
  });

  test('should handle dynamic value with number field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'rating',
      widget: 'number',
      default: 1,
    };

    populateDefaultValue({
      content,
      keyPath: 'rating',
      fieldConfig,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: { rating: '4.5' },
    });

    expect(content.rating).toBe(4.5);
  });
});

describe('Test getDefaultValues()', () => {
  test('should return empty object for empty fields array', () => {
    const result = getDefaultValues({ fields: [], locale: 'en', defaultLocale: 'en' });

    expect(result).toEqual({});
  });

  test('should return default values for multiple fields', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
      },
      {
        name: 'published',
        widget: 'boolean',
        default: false,
      },
      {
        name: 'rating',
        widget: 'number',
        default: 5,
      },
    ];

    const result = getDefaultValues({ fields, locale: 'en', defaultLocale: 'en' });

    expect(result).toEqual({
      title: 'Default Title',
      published: false,
      rating: 5,
    });
  });

  test('should apply dynamic values when provided', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
      },
      {
        name: 'published',
        widget: 'boolean',
        default: false,
      },
      {
        name: 'category',
        widget: 'select',
        default: 'general',
        options: ['general', 'tech', 'health'],
      },
    ];

    const dynamicValues = {
      title: 'Dynamic Title',
      published: 'true',
    };

    const result = getDefaultValues({ fields, locale: 'en', defaultLocale: 'en', dynamicValues });

    expect(result).toEqual({
      title: 'Dynamic Title',
      published: true,
      category: 'general', // should use default since no dynamic value provided
    });
  });

  test('should handle fields without `widget` specified', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        default: 'Default Title',
      },
      {
        name: 'description',
        widget: 'text',
        default: 'Default Description',
      },
    ];

    const result = getDefaultValues({ fields, locale: 'en', defaultLocale: 'en' });

    expect(result).toEqual({
      title: 'Default Title',
      description: 'Default Description',
    });
  });

  test('should handle compute field types', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
      },
      {
        name: 'computed_field',
        widget: 'compute',
        value: '{{title}}-{{slug}}',
        default: 'Should be ignored',
      },
      {
        name: 'description',
        widget: 'text',
        default: 'Default Description',
      },
    ];

    const result = getDefaultValues({ fields, locale: 'en', defaultLocale: 'en' });

    expect(result).toEqual({
      title: 'Default Title',
      computed_field: '',
      description: 'Default Description',
    });
  });

  test('should handle complex field configurations', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'metadata',
        widget: 'object',
        default: { author: 'John Doe', date: '2023-01-01' },
      },
      {
        name: 'tags',
        widget: 'list',
        default: ['tag1', 'tag2'],
      },
      {
        name: 'content',
        widget: 'markdown',
        default: '# Hello World',
      },
    ];

    const result = getDefaultValues({ fields, locale: 'en', defaultLocale: 'en' });

    expect(result).toEqual({
      metadata: { author: 'John Doe', date: '2023-01-01' },
      tags: ['tag1', 'tag2'],
      content: '# Hello World',
    });
  });

  test('should handle empty dynamic values object', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
      },
    ];

    const result = getDefaultValues({
      fields,
      locale: 'en',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    expect(result).toEqual({
      title: 'Default Title',
    });
  });

  test('should handle different locale', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
      },
    ];

    const result = getDefaultValues({ fields, locale: 'ja', defaultLocale: 'en' });

    // When locale is different from defaultLocale and field is not i18n-enabled,
    // the field should not be populated
    expect(result).toEqual({});
  });

  test('should populate i18n-enabled field for non-default locale', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
        i18n: true,
      },
    ];

    const result = getDefaultValues({ fields, locale: 'ja', defaultLocale: 'en' });

    // When locale is different but field is i18n-enabled, the field should be populated
    expect(result).toEqual({
      title: 'Default Title',
    });
  });

  test('should not populate field with i18n=none for non-default locale', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
        i18n: 'none',
      },
    ];

    const result = getDefaultValues({ fields, locale: 'ja', defaultLocale: 'en' });

    // When i18n is set to 'none', the field should not be populated for non-default locales
    expect(result).toEqual({});
  });

  test('should populate field for default locale regardless of i18n setting', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
        i18n: false,
      },
      {
        name: 'description',
        widget: 'string',
        default: 'Default Description',
        i18n: 'none',
      },
    ];

    const result = getDefaultValues({ fields, locale: 'en', defaultLocale: 'en' });

    // When locale equals defaultLocale, all fields should be populated regardless of i18n setting
    expect(result).toEqual({
      title: 'Default Title',
      description: 'Default Description',
    });
  });

  test('should ignore dynamic values for i18n-disabled field in non-default locale', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
        i18n: false,
      },
    ];

    const dynamicValues = {
      title: 'Dynamic Title',
    };

    const result = getDefaultValues({ fields, locale: 'ja', defaultLocale: 'en', dynamicValues });

    // i18n: false means the field should not be populated for non-default locales
    expect(result).toEqual({});
  });

  test('should apply dynamic values for i18n-enabled field in non-default locale', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
        i18n: true,
      },
    ];

    const dynamicValues = {
      title: 'Dynamic Title',
    };

    const result = getDefaultValues({ fields, locale: 'ja', defaultLocale: 'en', dynamicValues });

    // i18n: true means the field should be populated for non-default locales with dynamic values
    expect(result).toEqual({
      title: 'Dynamic Title',
    });
  });

  test('should handle populateDefaultValue with i18n-disabled field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'title',
      widget: 'string',
      default: 'Default Title',
      i18n: false,
    };

    populateDefaultValue({
      content,
      keyPath: 'title',
      fieldConfig,
      locale: 'ja',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    // When i18n is false and locale differs from defaultLocale, field should not be set
    expect(content).toEqual({});
  });

  test('should handle populateDefaultValue with i18n=none field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'title',
      widget: 'string',
      default: 'Default Title',
      i18n: 'none',
    };

    populateDefaultValue({
      content,
      keyPath: 'title',
      fieldConfig,
      locale: 'ja',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    // When i18n is 'none' and locale differs from defaultLocale, field should not be set
    expect(content).toEqual({});
  });

  test('should handle populateDefaultValue with i18n-enabled field', () => {
    /** @type {FlattenedEntryContent} */
    const content = {};

    /** @type {Field} */
    const fieldConfig = {
      name: 'title',
      widget: 'string',
      default: 'Default Title',
      i18n: true,
    };

    populateDefaultValue({
      content,
      keyPath: 'title',
      fieldConfig,
      locale: 'ja',
      defaultLocale: 'en',
      dynamicValues: {},
    });

    // When i18n is true and locale differs from defaultLocale, field should be set
    expect(content).toEqual({
      title: 'Default Title',
    });
  });

  test('should ignore dynamic values for array items in i18n-enabled field', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'tags',
        widget: 'string',
        default: 'Default Tag',
        i18n: true,
      },
    ];

    const dynamicValues = {
      'tags.0': 'Should be ignored',
    };

    const result = getDefaultValues({ fields, locale: 'ja', defaultLocale: 'en', dynamicValues });

    // Array-like key paths should be ignored even for i18n-enabled fields
    expect(result).toEqual({
      tags: 'Default Tag',
    });
  });

  test('should ignore dynamic values for array-like key paths', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'items',
        widget: 'string',
        default: 'Default Item',
      },
    ];

    const dynamicValues = {
      'items.0': 'Should be ignored',
      'items.0.name': 'Should also be ignored',
    };

    const result = getDefaultValues({ fields, locale: 'en', defaultLocale: 'en', dynamicValues });

    expect(result).toEqual({
      items: 'Default Item',
    });
  });

  test('should handle trimmed dynamic values', () => {
    /** @type {Field[]} */
    const fields = [
      {
        name: 'title',
        widget: 'string',
        default: 'Default Title',
      },
      {
        name: 'description',
        widget: 'string',
        default: 'Default Description',
      },
    ];

    const dynamicValues = {
      title: '  Trimmed Title  ',
      description: '   ', // Should be ignored and use default
    };

    const result = getDefaultValues({ fields, locale: 'en', defaultLocale: 'en', dynamicValues });

    expect(result).toEqual({
      title: 'Trimmed Title',
      description: 'Default Description',
    });
  });
});

describe('Test GET_DEFAULT_VALUE_MAP_FUNCTIONS (internal helper)', () => {
  test('should contain all field types', () => {
    const expectedFieldTypes = [
      'boolean',
      'code',
      'datetime',
      'file',
      'hidden',
      'image',
      'keyvalue',
      'list',
      'markdown',
      'number',
      'object',
      'relation',
      'select',
    ];

    expectedFieldTypes.forEach((fieldType) => {
      expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS).toHaveProperty(fieldType);
      expect(typeof GET_DEFAULT_VALUE_MAP_FUNCTIONS[fieldType]).toBe('function');
    });
  });

  test('should map image field type to file field type handler', () => {
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS.image).toBe(GET_DEFAULT_VALUE_MAP_FUNCTIONS.file);
  });

  test('should map relation field type to select field type handler', () => {
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS.relation).toBe(GET_DEFAULT_VALUE_MAP_FUNCTIONS.select);
  });

  test('should have function values for all field types', () => {
    Object.entries(GET_DEFAULT_VALUE_MAP_FUNCTIONS).forEach(([, func]) => {
      expect(typeof func).toBe('function');
    });
  });

  test('should return expected number of field types', () => {
    // 13 total: boolean, code, datetime, file, hidden, image (alias), keyvalue, list,
    // markdown, number, object, relation (alias), select
    expect(Object.keys(GET_DEFAULT_VALUE_MAP_FUNCTIONS)).toHaveLength(13);
  });

  test('should not contain string or text field types (handled as default)', () => {
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS).not.toHaveProperty('string');
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS).not.toHaveProperty('text');
  });

  test('should not contain compute field type (handled separately)', () => {
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS).not.toHaveProperty('compute');
  });
});
