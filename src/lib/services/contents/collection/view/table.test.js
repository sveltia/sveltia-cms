import { beforeEach, describe, expect, test, vi } from 'vitest';

import { allEntries } from '$lib/services/contents';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getField } from '$lib/services/contents/entry/fields';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { getFieldDisplayValue } from '$lib/services/contents/entry/values';
import { formatDate } from '$lib/services/utils/date';

import {
  getColumnSortKey,
  getConfiguredTableColumns,
  getTableCellValue,
  getTableColumns,
  hasConfiguredTableColumns,
  isTableColumnKey,
} from './table';

/**
 * @import { Entry, EntryTableColumn, InternalEntryCollection } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ locale: 'en' }),
);

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/collection/view/sort-keys', () => ({
  getSortKeyLabel: vi.fn(({ key }) => `label:${key}`),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({ getField: vi.fn() }));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn(() => 'Entry Summary'),
}));

vi.mock('$lib/services/contents/entry/values', () => ({
  getFieldDisplayValue: vi.fn(({ keyPath }) => `display:${keyPath}`),
}));

vi.mock('$lib/services/utils/date', () => ({
  formatDate: vi.fn((date, locale) => `${date.toISOString()}@${locale}`),
}));

/** @type {Record<string, Field>} */
const fieldMap = {
  title: { name: 'title', label: 'Title', widget: 'string' },
  name: { name: 'name', widget: 'string' },
  date: { name: 'date', label: 'Date', widget: 'datetime' },
  draft: { name: 'draft', label: 'Draft', widget: 'boolean' },
  'author.name': { name: 'name', label: 'Name', widget: 'string' },
  editor: { name: 'editor', label: 'Editor', widget: 'relation', collection: 'authors' },
};

/**
 * Create an entry collection for the tests.
 * @param {Record<string, any>} [options] Collection options to override.
 * @param {Record<string, any>} [i18n] I18n options to override.
 * @returns {InternalEntryCollection} Collection.
 */
const createCollection = (options = {}, i18n = {}) =>
  /** @type {any} */ ({
    name: 'posts',
    _type: 'entry',
    folder: 'content/posts',
    fields: Object.values(fieldMap),
    _i18n: {
      i18nEnabled: false,
      defaultLocale: '_default',
      canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
      ...i18n,
    },
    ...options,
  });

/**
 * Create an entry for the tests.
 * @param {Record<string, any>} [options] Entry properties to override.
 * @returns {Entry} Entry.
 */
const createEntry = (options = {}) =>
  /** @type {any} */ ({
    id: 'entry-1',
    slug: 'hello-world',
    subPath: 'hello-world',
    locales: {
      _default: { content: { title: 'Hello', draft: true } },
    },
    ...options,
  });

beforeEach(() => {
  vi.mocked(getField).mockImplementation(({ collectionName, keyPath }) =>
    collectionName === 'posts' ? fieldMap[keyPath] : undefined,
  );
});

describe('Test hasConfiguredTableColumns()', () => {
  test('returns `true` with `table_columns` or `summary_fields` defined', () => {
    expect(hasConfiguredTableColumns(createCollection({ table_columns: ['title'] }))).toBe(true);
    expect(hasConfiguredTableColumns(createCollection({ summary_fields: ['summary'] }))).toBe(true);
  });

  test('returns `false` without any columns configured', () => {
    expect(hasConfiguredTableColumns(createCollection({}))).toBe(false);
    expect(hasConfiguredTableColumns(createCollection({ table_columns: [] }))).toBe(false);
  });
});

describe('Test getConfiguredTableColumns()', () => {
  test('reads `table_columns` given as strings and objects', () => {
    expect(
      getConfiguredTableColumns(
        createCollection({
          table_columns: ['title', { field: 'date', label: 'Published' }, { field: 'draft' }],
        }),
      ),
    ).toEqual([
      { key: 'title' },
      { key: 'date', label: 'Published' },
      { key: 'draft', label: undefined },
    ]);
  });

  test('reads `summary_fields`, where `summary` stands for the entry summary', () => {
    expect(
      getConfiguredTableColumns(createCollection({ summary_fields: ['summary', 'title', 'date'] })),
    ).toEqual([{ key: '_summary' }, { key: 'title' }, { key: 'date' }]);
  });

  test('prefers `table_columns` over `summary_fields`', () => {
    expect(
      getConfiguredTableColumns(
        createCollection({ table_columns: ['date'], summary_fields: ['summary', 'title'] }),
      ),
    ).toEqual([{ key: 'date' }]);
  });

  test('returns `undefined` if neither option is defined', () => {
    expect(getConfiguredTableColumns(createCollection())).toBeUndefined();
    expect(
      getConfiguredTableColumns(createCollection({ table_columns: 'title', summary_fields: 'x' })),
    ).toBeUndefined();
  });
});

describe('Test isTableColumnKey()', () => {
  test('rejects a non-string or empty key', () => {
    const collection = createCollection();

    expect(isTableColumnKey(collection, undefined)).toBe(false);
    expect(isTableColumnKey(collection, 1)).toBe(false);
    expect(isTableColumnKey(collection, '')).toBe(false);
  });

  test('accepts the summary key and the special keys', () => {
    const collection = createCollection();

    expect(isTableColumnKey(collection, '_summary')).toBe(true);
    expect(isTableColumnKey(collection, 'slug')).toBe(true);
    expect(isTableColumnKey(collection, 'commit_author')).toBe(true);
    expect(isTableColumnKey(collection, 'commit_date')).toBe(true);
  });

  test('accepts the canonical slug key only with i18n enabled', () => {
    expect(isTableColumnKey(createCollection(), 'translationKey')).toBe(false);
    expect(isTableColumnKey(createCollection({}, { i18nEnabled: true }), 'translationKey')).toBe(
      true,
    );
  });

  test('accepts a defined field and rejects an undefined one', () => {
    const collection = createCollection();

    expect(isTableColumnKey(collection, 'title')).toBe(true);
    expect(isTableColumnKey(collection, 'author.name')).toBe(true);
    expect(isTableColumnKey(collection, 'category')).toBe(false);
  });
});

describe('Test template columns', () => {
  test('accepts a template as a column key', () => {
    expect(isTableColumnKey(createCollection(), '{{locales}}')).toBe(true);
    expect(isTableColumnKey(createCollection(), '{{dirname}}/{{filename}}')).toBe(true);
    expect(isTableColumnKey(createCollection(), '{{}}')).toBe(false);
  });

  test('labels a template column after its only tag, or the template itself', () => {
    expect(
      getTableColumns({
        collection: createCollection({
          table_columns: [
            '{{locales}}',
            '{{ dirname }}',
            '{{fields.date}}',
            '{{commit_date}}',
            '{{dirname}}/{{filename}}.{{extension}}',
            '{{date | date("YYYY")}}',
            { field: '{{filename}}', label: 'File' },
          ],
        }),
        sortKeys: [],
      }),
    ).toEqual([
      { key: '{{locales}}', label: 'table_column_keys.locales' },
      { key: '{{ dirname }}', label: 'table_column_keys.dirname' },
      { key: '{{fields.date}}', label: 'label:date' },
      { key: '{{commit_date}}', label: 'label:commit_date' },
      {
        key: '{{dirname}}/{{filename}}.{{extension}}',
        label: '{{dirname}}/{{filename}}.{{extension}}',
      },
      { key: '{{date | date("YYYY")}}', label: '{{date | date("YYYY")}}' },
      { key: '{{filename}}', label: 'File' },
    ]);
  });

  test('sorts a template column made of a single tag by the tag', () => {
    const collection = createCollection();
    const sortKeys = ['date', 'commit_date'];

    /**
     * Get the sort key of a column.
     * @param {string} key Column key.
     * @returns {string | undefined} Sort key.
     */
    const getSortKey = (key) =>
      getColumnSortKey({ collection, column: { key, label: '' }, sortKeys });

    expect(getSortKey('{{commit_date}}')).toBe('commit_date');
    expect(getSortKey('{{fields.date}}')).toBe('date');
    expect(getSortKey('{{locales}}')).toBeUndefined();
    expect(getSortKey('{{date | date("YYYY")}}')).toBeUndefined();
    expect(getSortKey('{{dirname}}/{{date}}')).toBeUndefined();
  });
});

describe('Test getTableColumns()', () => {
  test('returns the summary followed by the sort keys by default', () => {
    expect(
      getTableColumns({
        collection: createCollection(),
        sortKeys: ['title', '_summary', 'date', '_manual', 'commit_date', 'name'],
      }),
    ).toEqual([
      { key: '_summary', label: 'Title' },
      { key: 'date', label: 'label:date', fieldConfig: fieldMap.date },
      { key: 'commit_date', label: 'label:commit_date' },
      { key: 'name', label: 'label:name', fieldConfig: fieldMap.name },
    ]);
  });

  test('leaves out a custom identifier field and the canonical slug key with i18n', () => {
    expect(
      getTableColumns({
        collection: createCollection(
          { identifier_field: 'name' },
          { i18nEnabled: true, canonicalSlug: { key: 'translation_id' } },
        ),
        sortKeys: ['name', 'title', 'translation_id', 'slug'],
      }),
    ).toEqual([
      // The identifier field has no label, so the summary gets the localized label
      { key: '_summary', label: 'sort_keys._summary' },
      { key: 'title', label: 'label:title', fieldConfig: fieldMap.title },
      { key: 'slug', label: 'label:slug' },
    ]);
  });

  test('keeps the canonical slug key without i18n, if it names a field', () => {
    vi.mocked(getField).mockImplementation(({ keyPath }) =>
      keyPath === 'translationKey' ? { name: 'translationKey', widget: 'string' } : undefined,
    );

    expect(
      getTableColumns({ collection: createCollection(), sortKeys: ['translationKey'] }),
    ).toEqual([
      // No identifier field defined, so the summary gets the localized label
      { key: '_summary', label: 'sort_keys._summary' },
      {
        key: 'translationKey',
        label: 'label:translationKey',
        fieldConfig: { name: 'translationKey', widget: 'string' },
      },
    ]);
  });

  test('uses the localized summary label with a summary template', () => {
    expect(
      getTableColumns({
        collection: createCollection({ summary: '{{title}} ({{date}})' }),
        sortKeys: [],
      }),
    ).toEqual([{ key: '_summary', label: 'sort_keys._summary' }]);
  });

  test('uses the configured columns, dropping invalid and duplicate keys', () => {
    expect(
      getTableColumns({
        collection: createCollection(
          {
            table_columns: [
              { field: 'title', label: 'Headline' },
              'category',
              'title',
              '_summary',
              'author.name',
              { field: 'draft', label: '' },
              'translationKey',
              'commit_author',
            ],
          },
          { i18nEnabled: true },
        ),
        sortKeys: ['title'],
      }),
    ).toEqual([
      { key: 'title', label: 'Headline', fieldConfig: fieldMap.title },
      { key: '_summary', label: 'Title' },
      { key: 'author.name', label: 'label:author.name', fieldConfig: fieldMap['author.name'] },
      { key: 'draft', label: 'label:draft', fieldConfig: fieldMap.draft },
      { key: 'translationKey', label: 'label:translationKey' },
      { key: 'commit_author', label: 'label:commit_author' },
    ]);
  });

  test('doesn’t set the field config of a special key matching a field name', () => {
    vi.mocked(getField).mockImplementation(({ keyPath }) => ({
      name: keyPath,
      label: `Field ${keyPath}`,
      widget: 'string',
    }));

    expect(
      getTableColumns({
        collection: createCollection({ table_columns: ['_summary', 'slug', 'title'] }),
        sortKeys: [],
      }),
    ).toEqual([
      { key: '_summary', label: 'Field title' },
      { key: 'slug', label: 'label:slug' },
      {
        key: 'title',
        label: 'label:title',
        fieldConfig: { name: 'title', label: 'Field title', widget: 'string' },
      },
    ]);
  });
});

describe('Test getTableCellValue()', () => {
  const collection = createCollection();

  /**
   * Get a cell value of the given entry.
   * @param {EntryTableColumn} column Column.
   * @param {Entry} [entry] Entry.
   * @param {InternalEntryCollection} [_collection] Collection.
   * @returns {any} Value.
   */
  const getValue = (column, entry = createEntry(), _collection = collection) =>
    getTableCellValue({ collection: _collection, entry, column });

  test('returns the entry summary', () => {
    const entry = createEntry();

    expect(getValue({ key: '_summary', label: '' }, entry)).toEqual({
      type: 'text',
      value: 'Entry Summary',
    });
    expect(getEntrySummary).toHaveBeenCalledWith(collection, entry, { useTemplate: true });
  });

  test('formats a template the way a summary template is, for the index file as well', () => {
    const entry = createEntry();
    const key = '{{dirname}}/{{filename}}';

    expect(getValue({ key, label: '' }, entry)).toEqual({ type: 'text', value: 'Entry Summary' });
    expect(getEntrySummary).toHaveBeenCalledWith(collection, entry, {
      useTemplate: true,
      template: key,
      useIndexFileLabel: false,
    });
  });

  test('returns the slug', () => {
    expect(getValue({ key: 'slug', label: '' })).toEqual({ type: 'text', value: 'hello-world' });
  });

  test('returns the commit author’s name, login or email', () => {
    const column = { key: 'commit_author', label: '' };

    expect(
      getValue(
        column,
        createEntry({ commitAuthor: { name: 'Jane', login: 'jane', email: 'j@x' } }),
      ),
    ).toEqual({ type: 'text', value: 'Jane' });
    expect(
      getValue(column, createEntry({ commitAuthor: { login: 'jane', email: 'j@x' } })),
    ).toEqual({ type: 'text', value: 'jane' });
    expect(getValue(column, createEntry({ commitAuthor: { email: 'j@x' } }))).toEqual({
      type: 'text',
      value: 'j@x',
    });
    expect(getValue(column, createEntry({ commitAuthor: {} }))).toEqual({
      type: 'text',
      value: '',
    });
    expect(getValue(column)).toEqual({ type: 'text', value: '' });
  });

  test('returns the formatted commit date, or an empty string', () => {
    const column = { key: 'commit_date', label: '' };
    const commitDate = new Date('2026-01-02T03:04:05Z');

    expect(getValue(column, createEntry({ commitDate }))).toEqual({
      type: 'text',
      value: '2026-01-02T03:04:05.000Z@en',
    });
    expect(formatDate).toHaveBeenCalledWith(commitDate, 'en');
    expect(getValue(column)).toEqual({ type: 'text', value: '' });
  });

  test('returns the checked state of a Boolean field', () => {
    const column = { key: 'draft', label: '', fieldConfig: fieldMap.draft };

    expect(getValue(column)).toEqual({ type: 'boolean', value: true });
    expect(
      getValue(column, createEntry({ locales: { _default: { content: { draft: 'true' } } } })),
    ).toEqual({ type: 'boolean', value: false });
    expect(getValue(column, createEntry({ locales: { _default: { content: {} } } }))).toEqual({
      type: 'boolean',
      value: false,
    });
  });

  test('returns the display value of another field from the default locale', () => {
    const entry = createEntry();

    vi.mocked(isCollectionIndexFile).mockReturnValueOnce(true);

    expect(getValue({ key: 'title', label: '', fieldConfig: fieldMap.title }, entry)).toEqual({
      type: 'text',
      value: 'display:title',
    });
    expect(isCollectionIndexFile).toHaveBeenCalledWith(collection, entry);
    expect(getFieldDisplayValue).toHaveBeenCalledWith({
      collectionName: 'posts',
      valueMap: { title: 'Hello', draft: true },
      keyPath: 'title',
      locale: '_default',
      plainText: true,
      isIndexFile: true,
    });
  });

  test('reads a field without a config from the default locale', () => {
    const i18nCollection = createCollection({}, { i18nEnabled: true, defaultLocale: 'en' });

    const entry = createEntry({
      locales: {
        fr: { content: { translationKey: 'bonjour' } },
        en: { content: { translationKey: 'hello' } },
      },
    });

    expect(getValue({ key: 'translationKey', label: '' }, entry, i18nCollection)).toEqual({
      type: 'text',
      value: 'display:translationKey',
    });
    expect(getFieldDisplayValue).toHaveBeenCalledWith(
      expect.objectContaining({ valueMap: { translationKey: 'hello' }, locale: 'en' }),
    );
  });

  test('falls back to the entry’s first locale without the default one', () => {
    const i18nCollection = createCollection({}, { i18nEnabled: true, defaultLocale: 'en' });
    const entry = createEntry({ locales: { fr: { content: { title: 'Bonjour' } } } });

    getValue({ key: 'title', label: '', fieldConfig: fieldMap.title }, entry, i18nCollection);

    expect(getFieldDisplayValue).toHaveBeenCalledWith(
      expect.objectContaining({ valueMap: { title: 'Bonjour' }, locale: 'fr', isIndexFile: false }),
    );
  });

  test('uses an empty value map for an entry without locales', () => {
    getValue(
      { key: 'title', label: '', fieldConfig: fieldMap.title },
      createEntry({ locales: {} }),
    );

    expect(getFieldDisplayValue).toHaveBeenCalledWith(
      expect.objectContaining({ valueMap: {}, locale: undefined }),
    );
  });
});

describe('Test getColumnSortKey()', () => {
  const summaryColumn = { key: '_summary', label: '' };

  test('sorts the summary column by the summary if offered', () => {
    expect(
      getColumnSortKey({
        collection: createCollection(),
        column: summaryColumn,
        sortKeys: ['title', '_summary'],
      }),
    ).toBe('_summary');
  });

  test('sorts the summary column by the identifier field if offered', () => {
    expect(
      getColumnSortKey({
        collection: createCollection(),
        column: summaryColumn,
        sortKeys: ['title', 'date'],
      }),
    ).toBe('title');
    expect(
      getColumnSortKey({
        collection: createCollection({ identifier_field: 'name' }),
        column: summaryColumn,
        sortKeys: ['title', 'name'],
      }),
    ).toBe('name');
  });

  test('can’t sort the summary column without the summary or identifier field', () => {
    expect(
      getColumnSortKey({
        collection: createCollection({ identifier_field: 'name' }),
        column: summaryColumn,
        sortKeys: ['title'],
      }),
    ).toBeUndefined();
  });

  test('sorts another column by its key only if offered', () => {
    const collection = createCollection();

    expect(
      getColumnSortKey({ collection, column: { key: 'date', label: '' }, sortKeys: ['date'] }),
    ).toBe('date');
    expect(
      getColumnSortKey({ collection, column: { key: 'draft', label: '' }, sortKeys: ['date'] }),
    ).toBeUndefined();
  });
});

describe('Test getTableCellValue() with a Relation field', () => {
  const collection = createCollection();
  /** @type {EntryTableColumn} */
  const column = { key: 'editor', label: 'Editor', fieldConfig: fieldMap.editor };

  beforeEach(() => {
    vi.mocked(getFieldDisplayValue).mockReset().mockReturnValue('Alice');
    allEntries.current = [];
  });

  test('caches the label until the entry or the entry store changes', () => {
    const entry = createEntry();
    const expected = { type: 'text', value: 'Alice' };

    expect(getTableCellValue({ collection, entry, column })).toEqual(expected);
    expect(getTableCellValue({ collection, entry, column })).toEqual(expected);
    expect(getFieldDisplayValue).toHaveBeenCalledOnce();

    // The referenced entry may have changed
    allEntries.current = [];
    vi.mocked(getFieldDisplayValue).mockReturnValue('Alice Smith');

    expect(getTableCellValue({ collection, entry, column })).toEqual({
      type: 'text',
      value: 'Alice Smith',
    });
    expect(getFieldDisplayValue).toHaveBeenCalledTimes(2);

    // Another entry has a cache of its own
    getTableCellValue({ collection, entry: createEntry(), column });
    expect(getFieldDisplayValue).toHaveBeenCalledTimes(3);
  });

  test('caches each column and locale separately', () => {
    const entry = createEntry({
      locales: { fr: { content: { editor: 'bob' } } },
    });

    getTableCellValue({ collection, entry, column });
    getTableCellValue({ collection, entry, column: { ...column, key: 'author.name' } });
    getTableCellValue({ collection, entry, column });

    expect(getFieldDisplayValue).toHaveBeenCalledTimes(2);
    expect(getFieldDisplayValue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ locale: 'fr' }),
    );
  });
});

describe('Test getTableColumns() fallback', () => {
  test('uses the default columns when none of the configured ones can be shown', () => {
    const expected = [
      { key: '_summary', label: 'Title' },
      { key: 'date', label: 'label:date', fieldConfig: fieldMap.date },
    ];

    expect(
      getTableColumns({ collection: createCollection({ table_columns: [] }), sortKeys: ['date'] }),
    ).toEqual(expected);
    expect(
      getTableColumns({
        collection: createCollection({ table_columns: ['missing', ''] }),
        sortKeys: ['date'],
      }),
    ).toEqual(expected);
    expect(
      getTableColumns({ collection: createCollection({ summary_fields: [] }), sortKeys: ['date'] }),
    ).toEqual(expected);
  });
});

describe('Test getTableCellValue() with a special key template', () => {
  test('shows a template made of a special key’s tag the same as the key', () => {
    const collection = createCollection();
    const commitDate = new Date('2026-10-14T00:00:00Z');

    const entry = createEntry({
      commitDate,
      commitAuthor: { name: 'Alice' },
    });

    /**
     * Get a cell value.
     * @param {string} key Column key.
     * @returns {any} Value.
     */
    const getValue = (key) => getTableCellValue({ collection, entry, column: { key, label: '' } });

    expect(getValue('{{commit_date}}')).toEqual(getValue('commit_date'));
    expect(getValue('{{ commit_author }}')).toEqual({ type: 'text', value: 'Alice' });
    expect(getValue('{{slug}}')).toEqual({ type: 'text', value: 'hello-world' });
    expect(getEntrySummary).not.toHaveBeenCalledWith(
      collection,
      entry,
      expect.objectContaining({ template: '{{commit_date}}' }),
    );
  });
});
