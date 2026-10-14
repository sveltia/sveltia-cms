import { describe, expect, test } from 'vitest';

import {
  isTemplateColumnKey,
  METADATA_TEMPLATE_TAGS,
  SINGLE_TAG_REGEX,
  SPECIAL_COLUMN_KEYS,
  SUMMARY_COLUMN_KEY,
} from './table-keys';

describe('Test constants', () => {
  test('exports the column keys', () => {
    expect(SUMMARY_COLUMN_KEY).toBe('_summary');
    expect(SPECIAL_COLUMN_KEYS).toEqual(['slug', 'commit_author', 'commit_date']);
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
