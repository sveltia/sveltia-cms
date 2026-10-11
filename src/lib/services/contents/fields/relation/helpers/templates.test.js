import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  extractFieldNames,
  getFieldReplacement,
  prepareFieldTemplates,
  replaceTemplateFields,
} from '$lib/services/contents/fields/relation/helpers/templates';

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

  test('should not fall back to the entry summary or slug for an empty field', async () => {
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    vi.mocked(getEntrySummaryFromContent).mockReturnValue('Test Title');

    expect(getFieldReplacement('missing', context, fallbackContext)).toBe('');
    expect(context.getDisplayValue).toHaveBeenCalledWith('missing', '_default');
  });

  test('should fall back to the value in the default locale', () => {
    const localizedContext = {
      ...context,
      getDisplayValue: vi.fn((keyPath, locale) => (locale === '_default' ? 'Default' : '')),
    };

    expect(getFieldReplacement('name', localizedContext, fallbackContext)).toBe('Default');
  });

  test('should strip fields. prefix when getting value', () => {
    getFieldReplacement('fields.email', context, fallbackContext);
    expect(context.getDisplayValue).toHaveBeenCalledWith('email');
  });

  test('should get the stored value rather than the display value', () => {
    const storedFallbackContext = {
      ...fallbackContext,
      content: { sku: 123456, count: 0, featured: false, empty: '', none: null },
      locales: { _default: { content: { sku: 1, name: 'Default' } } },
    };

    /**
     * Get the stored value of the given field.
     * @param {string} fieldName Field name.
     * @returns {string} Value.
     */
    const getStored = (fieldName) =>
      getFieldReplacement(fieldName, context, storedFallbackContext, { stored: true });

    expect(getStored('fields.sku')).toBe('123456');
    // `0` and `false` are values, not empty fields
    expect(getStored('count')).toBe('0');
    expect(getStored('featured')).toBe('false');
    // An empty field falls back to the default locale
    expect(getStored('name')).toBe('Default');
    expect(getStored('empty')).toBe('');
    expect(getStored('none')).toBe('');
    expect(getStored('missing')).toBe('');
    expect(getStored('slug')).toBe('test-slug');
    expect(getStored('locale')).toBe('en');
    expect(context.getDisplayValue).not.toHaveBeenCalled();

    // The default locale can lack content
    expect(
      getFieldReplacement('name', context, { ...fallbackContext, locales: {} }, { stored: true }),
    ).toBe('');
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
    const result = replaceTemplateFields(templates, fieldNames, context, {
      ...fallbackContext,
      content: { id: '123' },
    });

    expect(result.label).toBe('John Doe - john@example.com');
    expect(result.value).toBe('123');
    expect(result.searchValue).toBe('John Doe john@example.com');
  });

  test('should put the stored value in the value and the display value elsewhere', () => {
    const result = replaceTemplateFields(
      { label: '{{sku}} ({{cat}})', value: '{{cat}}-{{sku}}', searchValue: '{{sku}}' },
      ['sku', 'cat'],
      {
        ...context,
        getDisplayValue: vi.fn(
          (/** @type {string} */ keyPath) =>
            /** @type {Record<string, string>} */ ({ sku: '123,456', cat: 'Books' })[keyPath] ?? '',
        ),
      },
      { ...fallbackContext, content: { sku: 123456, cat: 'b' } },
    );

    expect(result).toEqual({ label: '123,456 (Books)', value: 'b-123456', searchValue: '123,456' });
  });

  test('should insert field values containing `$` patterns verbatim', () => {
    const dollarContext = {
      ...context,
      getDisplayValue: vi.fn((keyPath) => {
        if (keyPath === 'name') return 'Save $$$ now';
        if (keyPath === 'email') return "$` $'";
        if (keyPath === 'id') return 'A $& B';
        return '';
      }),
    };

    const result = replaceTemplateFields(templates, fieldNames, dollarContext, {
      ...fallbackContext,
      content: { id: 'A $& B' },
    });

    expect(result.label).toBe("Save $$$ now - $` $'");
    expect(result.value).toBe('A $& B');
    expect(result.searchValue).toBe("Save $$$ now $` $'");
  });

  test('should handle undefined searchValue and set it to empty string', () => {
    const templatesWithoutSearch = {
      label: '{{name}}',
      value: '{{id}}',
      /** @type {any} */
      searchValue: undefined,
    };

    const result = replaceTemplateFields(templatesWithoutSearch, ['name', 'id'], context, {
      ...fallbackContext,
      content: { id: '123' },
    });

    expect(result.label).toBe('John Doe');
    expect(result.value).toBe('123');
    expect(result.searchValue).toBe('');
  });

  test('should leave empty replacements empty, falling back only for a wholly empty label', async () => {
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    const emptyContext = {
      ...context,
      getDisplayValue: vi.fn(() => ''),
    };

    // Vitest 4: Explicitly set mock return value to avoid leaking from other tests
    vi.mocked(getEntrySummaryFromContent).mockReturnValue('');

    // An empty field used to fall back to the entry summary or slug in every tag, giving
    // `test-slug - test-slug` and storing the slug as the value. Now each tag is replaced with an
    // empty string, and the value of a template with an empty tag is left empty
    let result = replaceTemplateFields(templates, fieldNames, emptyContext, fallbackContext);

    expect(result.label).toBe('-');
    expect(result.value).toBe('');
    expect(result.searchValue).toBe('');

    // A label that comes out empty falls back to the entry summary, then to the slug
    result = replaceTemplateFields(
      { ...templates, label: '{{name}} {{email}}' },
      fieldNames,
      emptyContext,
      fallbackContext,
    );

    expect(result.label).toBe('test-slug');

    vi.mocked(getEntrySummaryFromContent).mockReturnValueOnce('Summary');

    result = replaceTemplateFields(
      { ...templates, label: '{{name}} {{email}}' },
      fieldNames,
      emptyContext,
      fallbackContext,
    );

    expect(result.label).toBe('Summary');
  });

  test('should leave an empty field in a display template empty', async () => {
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    vi.mocked(getEntrySummaryFromContent).mockReturnValue('Alice');

    const result = replaceTemplateFields(
      { label: '{{name}} ({{nickname}})', value: '{{slug}}', searchValue: '{{name}} {{nickname}}' },
      ['name', 'nickname', 'slug'],
      { ...context, getDisplayValue: vi.fn((keyPath) => (keyPath === 'name' ? 'Alice' : '')) },
      fallbackContext,
    );

    // Not `Alice (Alice)`, with the entry summary in place of the missing nickname
    expect(result.label).toBe('Alice ()');
    expect(result.value).toBe('test-slug');
    expect(result.searchValue).toBe('Alice');
  });

  test('should leave the value empty when the value field is empty', async () => {
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    // The referenced entry has a title but no `id` yet
    const emptyIdContext = {
      ...context,
      getDisplayValue: vi.fn((keyPath) =>
        keyPath === 'name' ? 'John Doe' : keyPath === 'email' ? 'john@example.com' : '',
      ),
    };

    vi.mocked(getEntrySummaryFromContent).mockReturnValue('Hello World');

    const result = replaceTemplateFields(
      templates,
      fieldNames,
      emptyIdContext,
      // @ts-ignore Partial content
      { ...fallbackContext, content: { title: 'Hello World' } },
    );

    // The entry title used to be stored as the reference, which doesn’t match the entry once its
    // `id` is filled, or once the title changes. The empty value makes `processEntry()` leave the
    // option out, as the entry can’t be referenced
    expect(result.label).toBe('John Doe - john@example.com');
    expect(result.value).toBe('');

    // Also when the empty field is only a part of the value template
    expect(
      replaceTemplateFields(
        { ...templates, value: '{{slug}}#{{id}}' },
        [...fieldNames, 'slug'],
        emptyIdContext,
        fallbackContext,
      ).value,
    ).toBe('');
  });
});
