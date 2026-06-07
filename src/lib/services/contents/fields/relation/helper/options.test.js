import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createSimpleOption } from '$lib/services/contents/fields/relation/helper/options';

/**
 * @import { TemplateStrings } from '$lib/services/contents/fields/relation/helper/templates';
 */

// Mock dependencies
vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummaryFromContent: vi.fn(),
}));

describe('Test createSimpleOption()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should create a simple relation option', () => {
    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{name}}',
      _valueField: '{{id}}',
      _searchField: '{{name}} {{email}}',
      allFieldNames: ['name', 'id', 'email'],
      hasListFields: false,
    };

    const allFieldNames = ['name', 'id', 'email'];

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn((keyPath) => {
        if (keyPath === 'name') return 'John Doe';
        if (keyPath === 'id') return '123';
        if (keyPath === 'email') return 'john@example.com';
        return '';
      }),
    };

    const fallbackContext = {
      content: { name: 'John Doe' },
      locales: {},
      defaultLocale: 'en',
      identifierField: 'name',
    };

    const result = createSimpleOption({ templates, allFieldNames, context, fallbackContext });

    expect(result.label).toBe('John Doe');
    expect(result.value).toBe('123');
    expect(result.searchValue).toBe('John Doe john@example.com');
  });

  test('should use slug as fallback for empty label', async () => {
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{name}}',
      _valueField: '{{id}}',
      _searchField: '{{name}}',
      allFieldNames: ['name', 'id'],
      hasListFields: false,
    };

    const allFieldNames = ['name', 'id'];

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content: {},
      locales: { _default: { content: {} } },
      defaultLocale: '_default',
      identifierField: 'title',
    };

    // Vitest 4: Explicitly set mock return value to avoid leaking from other tests
    vi.mocked(getEntrySummaryFromContent).mockReturnValue('');

    const result = createSimpleOption({ templates, allFieldNames, context, fallbackContext });

    expect(result.label).toBe('test-slug');
    expect(result.value).toBe('test-slug');
  });

  test('should fall back to slug when label is empty after all fallback attempts', async () => {
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{name}}',
      _valueField: '{{id}}',
      _searchField: '{{name}}',
      allFieldNames: ['name', 'id'],
      hasListFields: false,
    };

    const allFieldNames = ['name', 'id'];

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content: { other: 'data' },
      locales: { _default: { content: { other: 'data' } } },
      defaultLocale: '_default',
      identifierField: 'title',
    };

    // Mock getEntrySummaryFromContent to return empty for both calls
    vi.mocked(getEntrySummaryFromContent).mockReturnValue('');

    const result = createSimpleOption({ templates, allFieldNames, context, fallbackContext });

    // Should fall back to slug after all fallback attempts fail
    expect(result.label).toBe('test-slug');
    expect(result.value).toBe('test-slug');
  });

  test('uses default-locale summary when primary content summary is empty', async () => {
    // Covers line 318 idx 1: first getEntrySummaryFromContent returns '' but
    // the second call (for defaultLocale content) returns a real value.
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{title}}',
      _valueField: '{{slug}}',
      _searchField: '{{title}}',
      allFieldNames: ['title', 'slug'],
      hasListFields: false,
    };

    const allFieldNames = ['title', 'slug'];

    const context = {
      slug: 'fallback-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content: {}, // empty — first getEntrySummaryFromContent returns ''
      locales: { en: { content: { title: 'Default Title' } } },
      defaultLocale: 'en',
      identifierField: 'title',
    };

    vi.mocked(getEntrySummaryFromContent)
      .mockReturnValueOnce('') // first call: primary content has no summary
      .mockReturnValueOnce('Default Title'); // second call: default locale content has summary

    const result = createSimpleOption({ templates, allFieldNames, context, fallbackContext });

    expect(result.label).toBe('Default Title');
  });

  test('uses {} when defaultLocale content is undefined (|| {} fallback)', async () => {
    // Covers line 319 idx 1: locales[defaultLocale]?.content is falsy,
    // so || {} is used before passing to getEntrySummaryFromContent.
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{title}}',
      _valueField: '{{slug}}',
      _searchField: '{{title}}',
      allFieldNames: ['title', 'slug'],
      hasListFields: false,
    };

    const allFieldNames = ['title', 'slug'];

    const context = {
      slug: 'my-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content: {},
      // defaultLocale locale entry exists but has no content property
      locales: { en: {} },
      defaultLocale: 'en',
      identifierField: 'title',
    };

    vi.mocked(getEntrySummaryFromContent).mockReturnValue(''); // both calls return ''

    const result = createSimpleOption({ templates, allFieldNames, context, fallbackContext });

    // Falls all the way through to slug
    expect(result.label).toBe('my-slug');
  });

  test('should use ?? {} fallback when locales[defaultLocale].content is falsy (line 319)', async () => {
    // First call returns '' (empty), second returns a value using the ?? {} fallback path
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    vi.mocked(getEntrySummaryFromContent).mockReturnValueOnce('');
    vi.mocked(getEntrySummaryFromContent).mockReturnValueOnce('Fallback Summary');

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{missing}}',
      _valueField: '{{id}}',
      _searchField: '{{missing}}',
      allFieldNames: ['missing', 'id'],
      hasListFields: false,
    };

    const context = {
      slug: 'test-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    // locales[defaultLocale].content is undefined → triggers ?? {} fallback on line 319
    const fallbackContext = {
      content: {},
      locales: { _default: { content: undefined } },
      defaultLocale: '_default',
      identifierField: 'title',
    };

    const result = createSimpleOption({
      templates,
      allFieldNames: ['missing', 'id'],
      context,
      fallbackContext,
    });

    expect(result.label).toBe('Fallback Summary');
    // Verify getEntrySummaryFromContent was called with {} (the ?? {} fallback)
    expect(vi.mocked(getEntrySummaryFromContent)).toHaveBeenCalledWith(
      {},
      { identifierField: 'title' },
    );
  });

  test('should use slug fallback when both getEntrySummaryFromContent calls return empty (line 320)', async () => {
    // Both calls return empty strings, so we fall through to the slug fallback
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    vi.mocked(getEntrySummaryFromContent).mockReturnValue('');

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{missing}}',
      _valueField: '{{id}}',
      _searchField: '{{missing}}',
      allFieldNames: ['missing', 'id'],
      hasListFields: false,
    };

    const context = {
      slug: 'fallback-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content: {},
      locales: {},
      defaultLocale: '_default',
      identifierField: 'title',
    };

    const result = createSimpleOption({
      templates,
      allFieldNames: ['missing', 'id'],
      context,
      fallbackContext,
    });

    // Should use slug as final fallback
    expect(result.label).toBe('fallback-slug');
  });

  test('should use slug as value fallback when _valueField is empty string (line 325)', () => {
    // When _valueField is '' there are no template tags, so value stays '' after substitution,
    // which triggers the `value || slug` fallback.

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '{{name}}',
      _valueField: '', // empty → value stays '' → falls back to slug
      _searchField: '{{name}}',
      allFieldNames: ['name'],
      hasListFields: false,
    };

    const context = {
      slug: 'value-fallback-slug',
      locale: 'en',
      getDisplayValue: vi.fn(() => 'Some Name'),
    };

    const fallbackContext = {
      content: { name: 'Some Name' },
      locales: {},
      defaultLocale: '_default',
      identifierField: 'name',
    };

    const result = createSimpleOption({
      templates,
      allFieldNames: ['name'],
      context,
      fallbackContext,
    });

    expect(result.label).toBe('Some Name');
    expect(result.value).toBe('value-fallback-slug');
  });

  test('should cover label||"" and searchValue||label||"" false branches when all fallbacks and slug are empty (lines 324-326)', async () => {
    // When slug = '' and all summary lookups return '', label becomes '' (via slug fallback).
    // This exercises the `label || ''` false branch (line 324) and the full
    // `searchValue || label || ''` chain fallback (line 326).
    const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

    vi.mocked(getEntrySummaryFromContent).mockReturnValue('');

    /** @type {TemplateStrings} */
    const templates = {
      _displayField: '', // no templates → label starts as ''
      _valueField: '', // no templates → value starts as ''
      _searchField: '', // no templates → searchValue starts as ''
      allFieldNames: [],
      hasListFields: false,
    };

    const context = {
      slug: '', // empty slug → label fallback also returns ''
      locale: 'en',
      getDisplayValue: vi.fn(() => ''),
    };

    const fallbackContext = {
      content: {},
      locales: {},
      defaultLocale: '_default',
      identifierField: 'title',
    };

    const result = createSimpleOption({ templates, allFieldNames: [], context, fallbackContext });

    expect(result.label).toBe(''); // label || '' → ''
    expect(result.value).toBe(''); // value || slug → '' || '' → ''
    expect(result.searchValue).toBe(''); // searchValue || label || '' → ''
  });
});
