import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';
import { getSortableFields } from '$lib/services/contents/collection/view';

vi.mock('$lib/services/config');

describe('Test getSortableFields()', async () => {
  /** @type {import('$lib/typedefs/private').EntryCollection} */
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
      canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
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
      getSortableFields({
        ...collectionBase,
      }),
    ).toEqual({
      fields: ['title', 'date', 'description'],
      default: { key: 'title', order: 'ascending' },
    });
    expect(
      getSortableFields({
        ...collectionBase,
        identifier_field: 'id',
      }),
    ).toEqual({
      fields: ['id', 'title', 'date', 'description'],
      default: { key: 'id', order: 'ascending' },
    });
  });

  test('simple sortable_fields', () => {
    expect(
      getSortableFields({
        ...collectionBase,
        sortable_fields: ['title', 'date'],
      }),
    ).toEqual({
      fields: ['title', 'date'],
      default: { key: 'title', order: 'ascending' },
    });
  });

  test('advanced sortable_fields', () => {
    expect(
      getSortableFields({
        ...collectionBase,
        sortable_fields: {
          fields: ['title', 'date'],
        },
      }),
    ).toEqual({
      fields: ['title', 'date'],
      default: { key: 'title', order: 'ascending' },
    });
    expect(
      getSortableFields({
        ...collectionBase,
        sortable_fields: {
          fields: ['title', 'date'],
          default: { field: 'date', direction: 'descending' },
        },
      }),
    ).toEqual({
      fields: ['title', 'date'],
      default: { key: 'date', order: 'descending' },
    });
  });
});
