import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  extractFieldNames,
  getFieldReplacement,
  prepareFieldTemplates,
  replaceTemplateFields,
} from '$lib/services/contents/fields/relation/helper/templates';

// Mock dependencies
vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummaryFromContent: vi.fn(),
}));

describe('Test extractFieldNames()', () => {
  test('should extract field names from template string', () => {
    expect(extractFieldNames('{{name}}')).toEqual(['name']);
    expect(extractFieldNames('{{name}} {{email}}')).toEqual(['name', 'email']);
    expect(extractFieldNames('{{name.first}} {{name.last}}')).toEqual(['name.first', 'name.last']);
  });

  test('should extract field names with wildcards', () => {
    expect(extractFieldNames('{{cities.*.name}}')).toEqual(['cities.*.name']);
    expect(extractFieldNames('{{items.*.id}} {{items.*.title}}')).toEqual([
      'items.*.id',
      'items.*.title',
    ]);
  });

  test('should handle templates with no fields', () => {
    expect(extractFieldNames('Plain text')).toEqual([]);
    expect(extractFieldNames('')).toEqual([]);
  });

  test('should handle mixed content', () => {
    expect(extractFieldNames('Name: {{name}}, Email: {{email}}')).toEqual(['name', 'email']);
  });
});

describe('Test prepareFieldTemplates()', () => {
  test('should prepare basic field templates with value_field', () => {
    const result = prepareFieldTemplates(
      { widget: 'relation', name: 'author', value_field: 'id', collection: 'authors' },
      'title',
    );

    expect(result._valueField).toBe('{{id}}');
    expect(result._displayField).toBe('{{id}}');
    expect(result._searchField).toBe('{{id}}');
    expect(result.allFieldNames).toContain('id');
    expect(result.hasListFields).toBe(false);
  });

  test('should use slug as default value field when not specified', () => {
    const result = prepareFieldTemplates(
      { widget: 'relation', name: 'author', collection: 'authors' },
      'title',
    );

    expect(result._valueField).toBe('{{slug}}');
  });

  test('should prepare templates with display_fields', () => {
    const result = prepareFieldTemplates(
      {
        widget: 'relation',
        name: 'author',
        value_field: 'id',
        display_fields: ['name.first', 'name.last'],
        collection: 'authors',
      },
      'title',
    );

    expect(result._displayField).toBe('{{name.first}} {{name.last}}');
    expect(result.allFieldNames).toContain('name.first');
    expect(result.allFieldNames).toContain('name.last');
  });

  test('should prepare templates with search_fields', () => {
    const result = prepareFieldTemplates(
      {
        widget: 'relation',
        name: 'author',
        value_field: 'id',
        display_fields: ['name'],
        search_fields: ['name', 'email'],
        collection: 'authors',
      },
      'title',
    );

    expect(result._searchField).toBe('{{name}} {{email}}');
  });

  test('should detect list fields with wildcards', () => {
    const result = prepareFieldTemplates(
      {
        widget: 'relation',
        name: 'author',
        display_fields: ['cities.*.name'],
        collection: 'authors',
      },
      'title',
    );

    expect(result.hasListFields).toBe(true);
    expect(result.allFieldNames).toContain('cities.*.name');
  });

  test('should handle slug field normalization', () => {
    const result = prepareFieldTemplates(
      {
        widget: 'relation',
        name: 'author',
        display_fields: ['slug'],
        collection: 'authors',
      },
      'title',
    );

    expect(result._displayField).toBe('{{fields.slug}}');
  });

  test('should handle template strings in display_fields', () => {
    const result = prepareFieldTemplates(
      {
        widget: 'relation',
        name: 'author',
        display_fields: ['{{name}} ({{email}})'],
        collection: 'authors',
      },
      'title',
    );

    expect(result._displayField).toBe('{{name}} ({{email}})');
    expect(result.allFieldNames).toContain('name');
    expect(result.allFieldNames).toContain('email');
  });
});

describe('Test getFieldReplacement()', () => {
  const context = {
    slug: 'test-slug',
    locale: 'en',
    getDisplayValue: vi.fn((keyPath) => {
      if (keyPath === 'title') return 'Test Title';
      if (keyPath === 'email') return 'test@example.com';
      return '';
    }),
  };

  const fallbackContext = {
    content: { title: 'Test Title' },
    locales: { _default: { content: { title: 'Default Title' } } },
    defaultLocale: '_default',
    identifierField: 'title',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return slug for slug field', () => {
    expect(getFieldReplacement('slug', context, fallbackContext)).toBe('test-slug');
  });

  test('should return locale for locale field', () => {
    expect(getFieldReplacement('locale', context, fallbackContext)).toBe('en');
  });

  test('should get display value for regular field', () => {
    expect(getFieldReplacement('title', context, fallbackContext)).toBe('Test Title');
    expect(context.getDisplayValue).toHaveBeenCalledWith('title');
  });

  test('should strip fields. prefix when getting value', () => {
    getFieldReplacement('fields.email', context, fallbackContext);
    expect(context.getDisplayValue).toHaveBeenCalledWith('email');
  });
});

describe('Test replaceTemplateFields()', () => {
  const templates = {
    label: '{{name}} - {{email}}',
    value: '{{id}}',
    searchValue: '{{name}} {{email}}',
  };

  const fieldNames = ['name', 'email', 'id'];

  const context = {
    slug: 'test-slug',
    locale: 'en',
    getDisplayValue: vi.fn((keyPath) => {
      if (keyPath === 'name') return 'John Doe';
      if (keyPath === 'email') return 'john@example.com';
      if (keyPath === 'id') return '123';
      return '';
    }),
  };

  const fallbackContext = {
    content: {},
    locales: {},
    defaultLocale: 'en',
    identifierField: 'title',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should replace all template fields', () => {
    const result = replaceTemplateFields(templates, fieldNames, context, fallbackContext);

    expect(result.label).toBe('John Doe - john@example.com');
    expect(result.value).toBe('123');
    expect(result.searchValue).toBe('John Doe john@example.com');
  });

  test('should handle undefined searchValue and set it to empty string', () => {
    const templatesWithoutSearch = {
      label: '{{name}}',
      value: '{{id}}',
      /** @type {any} */
      searchValue: undefined,
    };

    const result = replaceTemplateFields(
      templatesWithoutSearch,
      ['name', 'id'],
      context,
      fallbackContext,
    );

    expect(result.label).toBe('John Doe');
    expect(result.value).toBe('123');
    expect(result.searchValue).toBe('');
  });

  test('should handle empty replacements with fallback to slug', async () => {
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    const emptyContext = {
      ...context,
      getDisplayValue: vi.fn(() => ''),
    };

    // Vitest 4: Explicitly set mock return value to avoid leaking from other tests
    vi.mocked(getEntrySummaryFromContent).mockReturnValue('');

    const result = replaceTemplateFields(templates, fieldNames, emptyContext, fallbackContext);

    // When fields return empty, it falls back to slug via getFieldReplacement
    expect(result.label).toBe('test-slug - test-slug');
    expect(result.value).toBe('test-slug');
  });
});
