import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';
import { getSortConfig } from './sort-keys';

/**
 * @import { EntryCollection } from '$lib/types/private';
 */

vi.mock('$lib/services/config');
vi.mock('$lib/services/contents/entry/fields');

describe('Test getSortConfig()', async () => {
  const { getField } = await import('$lib/services/contents/entry/fields');

  // Mock getField to return field configs for the tests
  vi.mocked(getField).mockImplementation(({ collectionName, keyPath }) => {
    if (collectionName === 'posts') {
      switch (keyPath) {
        case 'title':
          return { name: 'title', widget: 'string' };
        case 'id':
          return { name: 'id', widget: 'string' };
        case 'date':
          return { name: 'date', widget: 'datetime' };
        case 'description':
          return { name: 'description', widget: 'text' };
        case 'author':
          return { name: 'author', widget: 'string' };
        case 'name':
          return { name: 'name', widget: 'string' };
        case 'author.name':
          return { name: 'name', widget: 'string' };
        case 'author.email':
          return { name: 'email', widget: 'string' };
        case 'custom_id':
          return { name: 'custom_id', widget: 'string' };
        default:
          return undefined;
      }
    }

    return undefined;
  });

  /** @type {EntryCollection} */
  const collectionBase = {
    name: 'posts',
    _type: 'entry',
    folder: 'content/posts',
    _i18n: {
      i18nEnabled: false,
      allLocales: ['_default'],
      initialLocales: ['_default'],
      defaultLocale: '_default',
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nRootMultiFolder: false,
      },
      canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
      omitDefaultLocaleFromFileName: false,
    },
    _file: {
      extension: 'json',
      format: 'json',
    },
    _thumbnailFieldNames: [],
    fields: [
      { name: 'title', widget: 'string' },
      { name: 'id', widget: 'string' },
      { name: 'date', widget: 'datetime' },
      { name: 'description', widget: 'text' },
    ],
  };

  // @ts-ignore
  (await import('$lib/services/config')).siteConfig = writable({
    backend: { name: 'github' },
    media_folder: 'static/uploads',
    collections: [{ ...collectionBase }],
  });

  test('sortable_fields not defined', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'name', 'date', 'author', 'description'],
      default: { key: 'title', order: 'ascending' },
    });
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          identifier_field: 'id',
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['id', 'title', 'name', 'date', 'author', 'description'],
      default: { key: 'id', order: 'ascending' },
    });
  });

  test('simple sortable_fields', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'date'],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('advanced sortable_fields', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: {
            fields: ['title', 'date'],
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'title', order: 'ascending' },
    });
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: {
            fields: ['title', 'date'],
            default: { field: 'date', direction: 'descending' },
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'date', order: 'descending' },
    });
  });

  test('handles special sort keys', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'slug', 'commit_author', 'commit_date'],
        },
        isCommitAuthorAvailable: true,
        isCommitDateAvailable: true,
      }),
    ).toEqual({
      keys: ['title', 'slug', 'commit_author', 'commit_date'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('filters out invalid field names', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'nonexistent_field', 'date', 'invalid_field'],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles empty sortable_fields array', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: [],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: [],
      default: { key: undefined, order: undefined },
    });
  });

  test('handles duplicate field names', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'date', 'title', 'description', 'date'],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date', 'description'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles advanced sortable_fields with invalid fields array', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          // @ts-expect-error - Testing invalid input
          sortable_fields: {
            fields: 'invalid', // Should be an array
            default: { field: 'title', direction: 'ascending' },
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: [],
      default: { key: undefined, order: undefined },
    });
  });

  test('handles advanced sortable_fields with missing fields property', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          // @ts-expect-error - Testing invalid input
          sortable_fields: {
            default: { field: 'title', direction: 'ascending' },
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: [],
      default: { key: undefined, order: undefined },
    });
  });

  test('handles various default direction values', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: {
            fields: ['title', 'date'],
            default: { field: 'date', direction: 'descending' },
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'date', order: 'descending' },
    });

    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: {
            fields: ['title', 'date'],
            default: { field: 'date', direction: 'Descending' },
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'date', order: 'descending' },
    });

    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: {
            fields: ['title', 'date'],
            default: { field: 'date', direction: 'ascending' },
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'date', order: 'ascending' },
    });

    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          // @ts-expect-error - Testing invalid direction value
          sortable_fields: {
            fields: ['title', 'date'],
            default: { field: 'date', direction: 'invalid' },
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'date', order: 'ascending' },
    });
  });

  test('handles default field not in sortable fields', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: {
            fields: ['title', 'date'],
            default: { field: 'nonexistent', direction: 'ascending' },
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles invalid default object', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          // @ts-expect-error - Testing invalid input
          sortable_fields: {
            fields: ['title', 'date'],
            default: 'invalid', // Should be an object
          },
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles identifier_field with custom sortable_fields', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          identifier_field: 'id',
          sortable_fields: ['title', 'date'],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles collection without any valid fields', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          fields: [], // No fields defined
          sortable_fields: ['title', 'date'],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'date'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles nested field key paths', () => {
    const collectionWithNestedFields = {
      ...collectionBase,
      fields: [
        { name: 'title', widget: 'string' },
        {
          name: 'author',
          widget: 'object',
          fields: [
            { name: 'name', widget: 'string' },
            { name: 'email', widget: 'string' },
          ],
        },
      ],
    };

    expect(
      getSortConfig({
        collection: {
          ...collectionWithNestedFields,
          sortable_fields: ['title', 'author.name', 'author.email'],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'author.name', 'author.email'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles mixed valid and invalid nested fields', () => {
    const collectionWithNestedFields = {
      ...collectionBase,
      fields: [
        { name: 'title', widget: 'string' },
        {
          name: 'author',
          widget: 'object',
          fields: [{ name: 'name', widget: 'string' }],
        },
      ],
    };

    expect(
      getSortConfig({
        collection: {
          ...collectionWithNestedFields,
          sortable_fields: ['title', 'author.name', 'author.invalid', 'invalid.field'],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'author.name'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles collection with only special keys', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['slug', 'commit_author', 'commit_date'],
        },
        isCommitAuthorAvailable: true,
        isCommitDateAvailable: true,
      }),
    ).toEqual({
      keys: ['slug', 'commit_author', 'commit_date'],
      default: { key: 'slug', order: 'ascending' },
    });
  });

  test('handles default field from DEFAULT_SORTABLE_FIELDS when custom identifier_field is invalid', () => {
    const collectionWithInvalidId = {
      ...collectionBase,
      identifier_field: 'nonexistent_field',
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'date', widget: 'datetime' },
      ],
    };

    expect(
      getSortConfig({
        collection: collectionWithInvalidId,
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'name', 'date', 'author', 'description'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles edge case with empty fields and special keys', () => {
    const collectionWithNoFields = {
      ...collectionBase,
      fields: [],
    };

    expect(
      getSortConfig({
        collection: {
          ...collectionWithNoFields,
          sortable_fields: ['slug', 'commit_author', 'invalid_field'],
        },
        isCommitAuthorAvailable: true,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['slug', 'commit_author'],
      default: { key: 'slug', order: 'ascending' },
    });
  });

  test('handles null/undefined sortable_fields', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          // @ts-expect-error - Testing invalid input
          sortable_fields: null,
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'name', 'date', 'author', 'description'],
      default: { key: 'title', order: 'ascending' },
    });

    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: undefined,
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'name', 'date', 'author', 'description'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles boolean sortable_fields (edge case)', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          // @ts-expect-error - Testing invalid input
          sortable_fields: false,
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'name', 'date', 'author', 'description'],
      default: { key: 'title', order: 'ascending' },
    });

    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          // @ts-expect-error - Testing invalid input
          sortable_fields: true,
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: [],
      default: { key: undefined, order: undefined },
    });
  });

  test('handles number sortable_fields (edge case)', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          // @ts-expect-error - Testing invalid input
          sortable_fields: 123,
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: [],
      default: { key: undefined, order: undefined },
    });
  });

  test('filters DEFAULT_SORTABLE_FIELDS based on actual collection fields', () => {
    const collectionWithLimitedFields = {
      ...collectionBase,
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'custom_field', widget: 'string' },
      ],
    };

    expect(
      getSortConfig({
        collection: collectionWithLimitedFields,
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'name', 'date', 'author', 'description'], // All DEFAULT_SORTABLE_FIELDS are checked
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('identifier_field takes precedence in default fields', () => {
    const collectionWithCustomId = {
      ...collectionBase,
      identifier_field: 'custom_id',
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'custom_id', widget: 'string' },
        { name: 'date', widget: 'datetime' },
      ],
    };

    expect(
      getSortConfig({
        collection: collectionWithCustomId,
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['custom_id', 'title', 'name', 'date', 'author', 'description'],
      default: { key: 'custom_id', order: 'ascending' },
    });
  });

  test('adds commit_author when isCommitAuthorAvailable is true and author field is not present', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'name', 'date', 'description'], // no 'author' field
        },
        isCommitAuthorAvailable: true,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'name', 'date', 'description', 'commit_author'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('does not add commit_author when isCommitAuthorAvailable is true but author field is present', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'name', 'date', 'author', 'description'], // 'author' field present
        },
        isCommitAuthorAvailable: true,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'name', 'date', 'author', 'description'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('adds commit_date when isCommitDateAvailable is true and date field is not present', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'name', 'author', 'description'], // no 'date' field
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: true,
      }),
    ).toEqual({
      keys: ['title', 'name', 'author', 'description', 'commit_date'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('does not add commit_date when isCommitDateAvailable is true but date field is present', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'name', 'date', 'author', 'description'], // 'date' field present
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: true,
      }),
    ).toEqual({
      keys: ['title', 'name', 'date', 'author', 'description'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('filters out commit fields when isCommitAuthorAvailable/isCommitDateAvailable are false', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'commit_author', 'commit_date', 'description'],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'description'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('handles mixed commit fields with isCommitAuthorAvailable/isCommitDateAvailable flags', () => {
    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'commit_author', 'commit_date', 'description'],
        },
        isCommitAuthorAvailable: true,
        isCommitDateAvailable: false,
      }),
    ).toEqual({
      keys: ['title', 'commit_author', 'description'],
      default: { key: 'title', order: 'ascending' },
    });

    expect(
      getSortConfig({
        collection: {
          ...collectionBase,
          sortable_fields: ['title', 'commit_author', 'commit_date', 'description'],
        },
        isCommitAuthorAvailable: false,
        isCommitDateAvailable: true,
      }),
    ).toEqual({
      keys: ['title', 'commit_date', 'description'],
      default: { key: 'title', order: 'ascending' },
    });
  });
});
