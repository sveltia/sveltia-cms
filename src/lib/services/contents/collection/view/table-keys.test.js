import { describe, expect, test } from 'vitest';

import {
  getConfiguredTableColumns,
  isTemplateColumnKey,
  METADATA_KEYS,
  METADATA_TEMPLATE_TAGS,
  SINGLE_TAG_REGEX,
  SUMMARY_COLUMN_KEY,
} from './table-keys';

describe('Test constants', () => {
  test('exports the column keys', () => {
    expect(SUMMARY_COLUMN_KEY).toBe('_summary');
    expect(METADATA_KEYS).toEqual(['slug', 'commit_author', 'commit_date']);
    expect(METADATA_TEMPLATE_TAGS).toEqual(['dirname', 'filename', 'extension', 'locales']);
  });

  test('matches a template made of a single tag', () => {
    expect('{{locales}}'.match(SINGLE_TAG_REGEX)?.[1]).toBe('locales');
    expect('{{ fields.author.name }}'.match(SINGLE_TAG_REGEX)?.[1]).toBe('author.name');
    expect('{{date | date("YYYY")}}'.match(SINGLE_TAG_REGEX)).toBeNull();
    expect('{{dirname}}/{{filename}}'.match(SINGLE_TAG_REGEX)).toBeNull();
  });
});

describe('Test isTemplateColumnKey()', () => {
  test('tells a template from a field name or a special key', () => {
    expect(isTemplateColumnKey('{{locales}}')).toBe(true);
    expect(isTemplateColumnKey('Path: {{dirname}}/{{filename}}')).toBe(true);
    expect(isTemplateColumnKey('title')).toBe(false);
    expect(isTemplateColumnKey('commit_date')).toBe(false);
    expect(isTemplateColumnKey('{{}}')).toBe(false);
  });
});

describe('Test getConfiguredTableColumns()', () => {
  test('reads `table_columns` given as strings and objects', () => {
    expect(
      getConfiguredTableColumns({
        table_columns: ['title', { field: 'date', label: 'Published' }, { field: 'draft' }],
      }),
    ).toEqual([
      { key: 'title' },
      { key: 'date', label: 'Published' },
      { key: 'draft', label: undefined },
    ]);
  });

  test('reads `summary_fields`, where `summary` stands for the entry summary', () => {
    expect(getConfiguredTableColumns({ summary_fields: ['summary', 'title', 'date'] })).toEqual([
      { key: '_summary' },
      { key: 'title' },
      { key: 'date' },
    ]);
  });

  test('prefers `table_columns` over `summary_fields`', () => {
    expect(
      getConfiguredTableColumns({ table_columns: ['date'], summary_fields: ['summary', 'title'] }),
    ).toEqual([{ key: 'date' }]);
  });

  test('returns `undefined` if neither option is defined', () => {
    expect(getConfiguredTableColumns({})).toBeUndefined();
    expect(
      getConfiguredTableColumns(
        /** @type {any} */ ({ table_columns: 'title', summary_fields: 'x' }),
      ),
    ).toBeUndefined();
  });
});
