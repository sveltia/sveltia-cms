import { describe, expect, test, vi } from 'vitest';

import {
  analyzeListFields,
  processComplexListField,
  processListFields,
  processSingleSubfieldList,
} from '$lib/services/contents/fields/relation/helper/list-fields';

/**
 * @import { TemplateStrings } from '$lib/services/contents/fields/relation/helper/templates';
 */

describe('Test analyzeListFields()', () => {
  const getFieldArgs = {
    collectionName: 'posts',
    fileName: undefined,
    isIndexFile: false,
    keyPath: '',
  };

  test('should return empty map when no list fields', () => {
    const allFieldNames = ['name', 'email', 'id'];
    const result = analyzeListFields(allFieldNames, getFieldArgs);

    expect(result.size).toBe(0);
  });

  test('should group list fields by base field name', () => {
    const allFieldNames = ['cities.*.name', 'cities.*.id'];
    const result = analyzeListFields(allFieldNames, getFieldArgs);

    expect(result.size).toBe(1);
    expect(result.has('cities')).toBe(true);

    const group = result.get('cities');

    expect(group).toHaveLength(2);
  });

  test('should handle multiple different list fields', () => {
    const allFieldNames = ['cities.*.name', 'tags.*', 'items.*.id'];
    const result = analyzeListFields(allFieldNames, getFieldArgs);

    expect(result.size).toBe(3);
    expect(result.has('cities')).toBe(true);
    expect(result.has('tags')).toBe(true);
    expect(result.has('items')).toBe(true);
  });
});

describe('Test processSingleSubfieldList()', () => {
  test('should produce one option per list item', () => {
    const content = {
      'skills.0': 'JavaScript',
      'skills.1': 'React',
      'skills.2': 'Node.js',
    };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{skills.*}}',
      _valueField: '{{id}}',
      _searchField: '{{skills.*}}',
      allFieldNames: ['skills.*', 'id'],
      hasListFields: true,
    };

    const allFieldNames = ['skills.*', 'id'];
    /** @type {[string, any][]} */
    const groupEntries = [['skills.*', { baseFieldName: 'skills' }]];

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn((keyPath) => {
        if (keyPath === 'id') return '123';
        return '';
      }),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: 'en',
      identifierField: 'title',
    };

    const result = processSingleSubfieldList({
      baseFieldName: 'skills',
      groupEntries,
      content,
      templates,
      allFieldNames,
      context,
      fallbackContext,
    });

    expect(result).toHaveLength(3);
    expect(result[0].label).toBe('JavaScript');
    expect(result[1].label).toBe('React');
    expect(result[2].label).toBe('Node.js');
    result.forEach((option) => expect(option.value).toBe('123'));
  });

  test('should handle list items with empty values', () => {
    const content = {
      'skills.0': '',
      'skills.1': 'React',
      'skills.2': '',
    };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{skills.*}}',
      _valueField: '{{id}}',
      _searchField: '{{skills.*}}',
      allFieldNames: ['skills.*', 'id'],
      hasListFields: true,
    };

    const allFieldNames = ['skills.*', 'id'];
    /** @type {[string, any][]} */
    const groupEntries = [['skills.*', { baseFieldName: 'skills' }]];

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn((keyPath) => {
        if (keyPath === 'id') return '123';
        return '';
      }),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: 'en',
      identifierField: 'title',
    };

    const result = processSingleSubfieldList({
      baseFieldName: 'skills',
      groupEntries,
      content,
      templates,
      allFieldNames,
      context,
      fallbackContext,
    });

    // Each item is still returned as a separate option
    expect(result).toHaveLength(3);
    expect(result[1].label).toBe('React');
    result.forEach((option) => expect(option.value).toBe('123'));
  });

  test('should reuse the cached regex for the same baseFieldName on successive calls', () => {
    const content = { 'skills.0': 'TypeScript', 'skills.1': 'Svelte' };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{skills.*}}',
      _valueField: '{{id}}',
      _searchField: '{{skills.*}}',
      allFieldNames: ['skills.*', 'id'],
      hasListFields: true,
    };

    const allFieldNames = ['skills.*', 'id'];
    /** @type {[string, any][]} */
    const groupEntries = [['skills.*', { baseFieldName: 'skills' }]];

    const context = {
      slug: 'slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: 'en',
      identifierField: 'id',
    };

    const args = {
      baseFieldName: 'skills',
      groupEntries,
      content,
      templates,
      allFieldNames,
      context,
      fallbackContext,
    };

    const result1 = processSingleSubfieldList(args);
    // Second call reuses the cached regex built from baseFieldName.
    const result2 = processSingleSubfieldList(args);

    expect(result1).toEqual(result2);
    expect(result1).toHaveLength(2);
  });

  test('should use context.slug as value fallback when item value is empty string (line 441)', () => {
    // When the list item value is '' the substituted _valueField also becomes '',
    // triggering the `value || context.slug` fallback.
    const content = { 'tags.0': '' };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{tags.*}}',
      _valueField: '{{tags.*}}',
      _searchField: '{{tags.*}}',
      allFieldNames: ['tags.*'],
      hasListFields: true,
    };

    /** @type {[string, any][]} */
    const groupEntries = [['tags.*', { baseFieldName: 'tags', isComplexListField: false }]];

    const context = {
      slug: 'fallback-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: '_default',
      identifierField: 'name',
    };

    const result = processSingleSubfieldList({
      baseFieldName: 'tags',
      groupEntries,
      content,
      templates,
      allFieldNames: ['tags.*'],
      context,
      fallbackContext,
    });

    expect(result).toHaveLength(1);
    // Empty item value → value = '' → falls back to context.slug
    expect(result[0].value).toBe('fallback-slug');
  });
});

describe('Test processComplexListField()', () => {
  test('should process complex list field with multiple items', () => {
    const content = {
      'cities.0.id': 'city1',
      'cities.0.name': 'New York',
      'cities.1.id': 'city2',
      'cities.1.name': 'Boston',
    };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{cities.*.name}}',
      _valueField: '{{cities.*.id}}',
      _searchField: '{{cities.*.name}}',
      allFieldNames: ['cities.*.name', 'cities.*.id'],
      hasListFields: true,
    };

    const allFieldNames = ['cities.*.name', 'cities.*.id'];

    /** @type {[string, any][]} */
    const groupEntries = [
      ['cities.*.name', { baseFieldName: 'cities' }],
      ['cities.*.id', { baseFieldName: 'cities' }],
    ];

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: 'en',
      identifierField: 'title',
    };

    const result = processComplexListField({
      groupEntries,
      content,
      templates,
      allFieldNames,
      context,
      fallbackContext,
    });

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('New York');
    expect(result[0].value).toBe('city1');
    expect(result[1].label).toBe('Boston');
    expect(result[1].value).toBe('city2');
  });

  test('should produce identical results when called twice with same args (indexRegex used for both filter and capture)', () => {
    // Verifies the refactored path where the single `indexRegex` (capturing group) is used
    // both to filter and to extract the index, replacing the old separate `regex`.
    const content = {
      'cities.0.name': 'Rome',
      'cities.0.id': 'rome',
      'cities.1.name': 'Milan',
      'cities.1.id': 'milan',
    };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{cities.*.name}}',
      _valueField: '{{cities.*.id}}',
      _searchField: '{{cities.*.name}}',
      allFieldNames: ['cities.*.name', 'cities.*.id'],
      hasListFields: true,
    };

    /** @type {[string, any][]} */
    const groupEntries = [
      ['cities.*.name', { baseFieldName: 'cities' }],
      ['cities.*.id', { baseFieldName: 'cities' }],
    ];

    const context = { slug: 'slug', locale: 'en', getDisplayValue: vi.fn(() => '') };
    const fallbackContext = { content, locales: {}, defaultLocale: 'en', identifierField: 'title' };

    const callArgs = {
      groupEntries,
      content,
      templates,
      allFieldNames: templates.allFieldNames,
      context,
      fallbackContext,
    };

    const result1 = processComplexListField(callArgs);
    const result2 = processComplexListField(callArgs);

    expect(result1).toEqual(result2);
    expect(result1[0]).toEqual({ label: 'Rome', value: 'rome', searchValue: 'Rome' });
    expect(result1[1]).toEqual({ label: 'Milan', value: 'milan', searchValue: 'Milan' });
  });

  test('should handle missing list items with empty value fallback to slug', () => {
    const content = {
      'cities.0.id': '',
      'cities.0.name': '',
      'cities.1.id': 'city2',
      'cities.1.name': 'Boston',
    };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{cities.*.name}}',
      _valueField: '{{cities.*.id}}',
      _searchField: '{{cities.*.name}}',
      allFieldNames: ['cities.*.name', 'cities.*.id'],
      hasListFields: true,
    };

    const allFieldNames = ['cities.*.name', 'cities.*.id'];

    /** @type {[string, any][]} */
    const groupEntries = [
      ['cities.*.name', { baseFieldName: 'cities' }],
      ['cities.*.id', { baseFieldName: 'cities' }],
    ];

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: 'en',
      identifierField: 'title',
    };

    const result = processComplexListField({
      groupEntries,
      content,
      templates,
      allFieldNames,
      context,
      fallbackContext,
    });

    expect(result).toHaveLength(2);
    // First item has empty value/label, should fall back to slug
    expect(result[0].value).toBe('test-slug');
    // Second item has values
    expect(result[1].label).toBe('Boston');
    expect(result[1].value).toBe('city2');
  });

  test('should return empty array when no valid pattern found', () => {
    const result = processComplexListField({
      groupEntries: [],
      content: {},
      templates: {
        _displayField: '',
        _valueField: '',
        _searchField: '',
        allFieldNames: [],
        hasListFields: false,
      },
      allFieldNames: [],
      context: { slug: '', locale: 'en', getDisplayValue: vi.fn() },
      fallbackContext: {
        content: {},
        locales: {},
        defaultLocale: 'en',
        identifierField: 'title',
      },
    });

    expect(result).toHaveLength(0);
  });

  test('should return empty array when pattern does not match (line 453)', () => {
    // Test coverage for line 453: return []; when subFieldMatch is null
    const result = processComplexListField({
      groupEntries: [['cities', { baseFieldName: 'cities' }]],
      content: {
        'cities.0': 'New York',
        'cities.1': 'Boston',
      },
      templates: {
        _displayField: '{{cities}}',
        _valueField: '{{id}}',
        _searchField: '{{cities}}',
        allFieldNames: ['cities', 'id'],
        hasListFields: false,
      },
      allFieldNames: ['cities', 'id'],
      context: { slug: '', locale: 'en', getDisplayValue: vi.fn() },
      fallbackContext: {
        content: {},
        locales: {},
        defaultLocale: 'en',
        identifierField: 'title',
      },
    });

    expect(result).toHaveLength(0);
  });

  test('skips groupEntries item that does not match COMPLEX_LIST_FIELD_REGEX', () => {
    // When a wildcardFieldName like 'skills.*' (simple list) is mixed into
    // groupEntries for a complex-list call, COMPLEX_LIST_FIELD_REGEX won't
    // match it, so the `if (wildcardMatch)` false branch is taken for that item.
    const content = { 'cities.0.name': 'Paris', 'cities.1.name': 'Lyon' };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{cities.*.name}}',
      _valueField: '{{cities.*.name}}',
      _searchField: '{{cities.*.name}}',
      allFieldNames: ['cities.*.name'],
      hasListFields: true,
    };

    // 'extra.*' does NOT match /^(.+)\.\*\.(.+)$/ — covers the if(wildcardMatch)===false branch
    /** @type {[string, any][]} */
    const groupEntries = [
      ['cities.*.name', { baseFieldName: 'cities' }],
      ['extra.*', { baseFieldName: 'extra' }], // simple wildcard — no subkey
    ];

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: 'en',
      identifierField: 'title',
    };

    const result = processComplexListField({
      groupEntries,
      content,
      templates,
      allFieldNames: ['cities.*.name'],
      context,
      fallbackContext,
    });

    // Both cities are returned; the 'extra.*' entry is silently skipped
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Paris');
    expect(result[1].label).toBe('Lyon');
  });

  test('should reuse the cached indexRegex for the same base:sub pair', () => {
    // The 'towns.*' key is fresh — not used in any other `processComplexListField` test above —
    // so the first call below is a guaranteed cache miss, making the second a verified cache hit.
    const content = {
      'towns.0.code': 'ldn',
      'towns.0.label': 'London',
      'towns.1.code': 'par',
      'towns.1.label': 'Paris',
    };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{towns.*.label}}',
      _valueField: '{{towns.*.code}}',
      _searchField: '{{towns.*.label}}',
      allFieldNames: ['towns.*.label', 'towns.*.code'],
      hasListFields: true,
    };

    const args = {
      groupEntries: /** @type {[string, any][]} */ ([
        ['towns.*.label', { baseFieldName: 'towns' }],
        ['towns.*.code', { baseFieldName: 'towns' }],
      ]),
      content,
      templates,
      allFieldNames: templates.allFieldNames,
      context: { slug: 'slug', locale: 'en', getDisplayValue: vi.fn(() => '') },
      fallbackContext: { content, locales: {}, defaultLocale: 'en', identifierField: 'id' },
    };

    const result1 = processComplexListField(args);
    // Second call: complexListIndexRegexCache hit — no new RegExp construction.
    const result2 = processComplexListField(args);

    expect(result1).toEqual(result2);
    expect(result1).toHaveLength(2);
  });
});

describe('Test processListFields()', () => {
  test('should return empty results when no list fields', () => {
    const result = processListFields({
      baseFieldGroups: new Map(),
      content: {},
      templates: {
        _displayField: '',
        _valueField: '',
        _searchField: '',
        allFieldNames: [],
        hasListFields: false,
      },
      allFieldNames: [],
      context: { slug: '', locale: 'en', getDisplayValue: vi.fn() },
      fallbackContext: {
        content: {},
        locales: {},
        defaultLocale: 'en',
        identifierField: 'title',
      },
    });

    expect(result.results).toHaveLength(0);
    expect(result.hasProcessedListFields).toBe(false);
  });

  test('should process single subfield list fields and return results', () => {
    const content = {
      'tags.0': 'JavaScript',
      'tags.1': 'React',
    };

    /** @type {[string, any][]} */
    const groupEntries = [['tags.*', { isComplexListField: false }]];
    const baseFieldGroups = new Map();

    baseFieldGroups.set('tags', groupEntries);

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{tags.*}}',
      _valueField: '{{id}}',
      _searchField: '{{tags.*}}',
      allFieldNames: ['tags.*', 'id'],
      hasListFields: true,
    };

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn((keyPath) => {
        if (keyPath === 'id') return '123';
        return '';
      }),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: 'en',
      identifierField: 'title',
    };

    const result = processListFields({
      baseFieldGroups,
      content,
      templates,
      allFieldNames: ['tags.*', 'id'],
      context,
      fallbackContext,
    });

    expect(result.hasProcessedListFields).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
  });

  test('should process complex list fields and return results', () => {
    const content = {
      'cities.0.id': 'city1',
      'cities.0.name': 'New York',
      'cities.1.id': 'city2',
      'cities.1.name': 'Boston',
    };

    /** @type {[string, any][]} */
    const groupEntries = [
      ['cities.*.id', { isComplexListField: true }],
      ['cities.*.name', { isComplexListField: true }],
    ];

    const baseFieldGroups = new Map();

    baseFieldGroups.set('cities', groupEntries);

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{cities.*.name}}',
      _valueField: '{{cities.*.id}}',
      _searchField: '{{cities.*.name}}',
      allFieldNames: ['cities.*.id', 'cities.*.name'],
      hasListFields: true,
    };

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: 'en',
      identifierField: 'title',
    };

    const result = processListFields({
      baseFieldGroups,
      content,
      templates,
      allFieldNames: ['cities.*.id', 'cities.*.name'],
      context,
      fallbackContext,
    });

    expect(result.hasProcessedListFields).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
  });

  test('should skip empty group entries in processListFields (lines 548-549)', () => {
    /** @type {Map<string, any>} */
    const baseFieldGroups = new Map([
      ['empty', []],
      [
        'items',
        [
          [
            'items.*',
            {
              isComplexListField: false,
            },
          ],
        ],
      ],
    ]);

    const content = { 'items.0': 'value' };

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{items.*}}',
      _valueField: '{{items.*}}',
      _searchField: '{{items.*}}',
      allFieldNames: ['items.*'],
      hasListFields: true,
    };

    const context = {
      slug: 'test',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content,
      locales: {},
      defaultLocale: 'en',
      identifierField: 'title',
    };

    const result = processListFields({
      baseFieldGroups,
      content,
      templates,
      allFieldNames: ['items.*'],
      context,
      fallbackContext,
    });

    // Should process only non-empty groups
    expect(result.hasProcessedListFields).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
  });
});
