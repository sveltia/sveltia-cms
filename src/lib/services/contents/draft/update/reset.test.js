import { describe, expect, test, vi } from 'vitest';

import { syncAllDuplicateKeys } from '$lib/services/contents/fields/key-value/duplicate-keys';

import { canResetEntry, canResetField, resetEntry, resetField } from './reset';

/**
 * @import { EntryDraft, FlattenedEntryContent } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/fields/key-value/duplicate-keys');
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(() => ({
    name: 'posts',
    _type: 'entry',
    fields: [
      {
        name: 'venue',
        widget: 'object',
        i18n: 'duplicate',
        fields: [
          { name: 'name', widget: 'string' },
          { name: 'rooms', widget: 'list' },
        ],
      },
    ],
  })),
}));

/** @type {Field} */
const authorField = {
  name: 'author',
  widget: 'object',
  fields: [
    { name: 'id', widget: 'uuid' },
    { name: 'kind', widget: 'hidden', default: 'person' },
    { name: 'slug', widget: 'compute', value: '{{fields.author.name}}' },
    { name: 'code', widget: 'string', readonly: true },
    { name: 'name', widget: 'string', default: 'Anonymous' },
    { name: 'age', widget: 'number' },
    { name: 'active', widget: 'boolean', default: true },
    { name: 'links', widget: 'list', max: 1, fields: [{ name: 'url', widget: 'string' }] },
    { name: 'meta', widget: 'keyvalue' },
    { name: 'address', widget: 'object', fields: [{ name: 'city', widget: 'string' }] },
  ],
};

/** @type {FlattenedEntryContent} */
const authorValues = {
  'author.id': '0b8b6c2e-5b52-4f4e-9d59-0f7b6a1c2d3e',
  'author.kind': 'person',
  'author.slug': 'melvin',
  'author.code': 'M1',
  'author.name': 'Melvin',
  'author.age': 42,
  'author.active': true,
  'author.links.0.url': 'https://example.com',
  'author.links.0.__sc_item_id': 'abc',
  'author.meta.a': '1',
  'author.address.city': 'Toronto',
};

/**
 * Create an entry draft holding the given values.
 * @param {Record<string, FlattenedEntryContent>} currentValues Values keyed by locale.
 * @param {string} [defaultLocale] Default locale.
 * @returns {EntryDraft} Draft.
 */
const createDraft = (currentValues, defaultLocale = 'en') =>
  /** @type {EntryDraft} */ (
    /** @type {unknown} */ ({
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      defaultLocale,
      currentValues,
    })
  );

describe('Test resetField()', () => {
  test('should empty the subfields of an Object field, keeping the ones the user doesn’t enter', () => {
    const draft = createDraft({ en: { title: 'Hello', ...authorValues } });

    resetField({ draft, fieldConfig: authorField, keyPath: 'author', locale: 'en' });

    // The defaults aren’t applied, and a required List field limited to one item gets no item
    expect(draft.currentValues.en).toEqual({
      title: 'Hello',
      'author.id': '0b8b6c2e-5b52-4f4e-9d59-0f7b6a1c2d3e',
      'author.kind': 'person',
      'author.slug': 'melvin',
      'author.code': 'M1',
      'author.name': '',
      'author.age': null,
      'author.active': false,
      'author.links': [],
      'author.meta': null,
      'author.address.city': '',
    });
    expect(syncAllDuplicateKeys).toHaveBeenCalledExactlyOnceWith({
      valueStore: draft.currentValues,
      defaultLocale: 'en',
      getFieldArgs: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
    });
  });

  test('should remove the items of a List field and the pairs of a KeyValue field', () => {
    const draft = createDraft({
      en: { tags: [], 'tags.0': 'a', 'tags.1': 'b', 'meta.a': '1', 'meta.b': '2', title: 'Hi' },
    });

    resetField({
      draft,
      fieldConfig: { name: 'tags', widget: 'list' },
      keyPath: 'tags',
      locale: 'en',
    });
    resetField({
      draft,
      fieldConfig: { name: 'meta', widget: 'keyvalue' },
      keyPath: 'meta',
      locale: 'en',
    });

    expect(draft.currentValues.en).toEqual({ tags: [], meta: null, title: 'Hi' });
  });

  test('should keep the type of an Object field with variable types', () => {
    /** @type {Field} */
    const fieldConfig = {
      name: 'hero',
      widget: 'object',
      types: [
        { name: 'image', fields: [{ name: 'alt', widget: 'string' }] },
        { name: 'quote', fields: [{ name: 'text', widget: 'string' }] },
      ],
    };

    const draft = createDraft({
      en: { 'hero.type': 'quote', 'hero.text': 'Look up.' },
      fr: { 'hero.type': 'unknown', 'hero.text': 'Levez les yeux.' },
    });

    resetField({ draft, fieldConfig, keyPath: 'hero', locale: 'en' });
    expect(draft.currentValues.en).toEqual({ 'hero.type': 'quote', 'hero.text': '' });

    // An unknown type has no subfields to clear
    resetField({
      draft,
      fieldConfig: { ...fieldConfig, i18n: true },
      keyPath: 'hero',
      locale: 'fr',
    });
    expect(draft.currentValues.fr).toEqual({
      'hero.type': 'unknown',
      'hero.text': 'Levez les yeux.',
    });
  });

  test('should leave a collapsed optional Object field alone', () => {
    const draft = createDraft({ en: { author: null } });

    resetField({ draft, fieldConfig: authorField, keyPath: 'author', locale: 'en' });

    expect(draft.currentValues.en).toEqual({ author: null });
  });

  test('should only clear the subfields that can be edited in another locale', () => {
    /** @type {Field} */
    const fieldConfig = {
      name: 'author',
      widget: 'object',
      i18n: true,
      fields: [
        { name: 'name', widget: 'string', i18n: true },
        // Only translatable with an `i18n` option of its own, so it isn’t shown in another locale
        { name: 'nickname', widget: 'string' },
        { name: 'email', widget: 'string', i18n: false },
        { name: 'bio', widget: 'string', i18n: 'duplicate' },
      ],
    };

    const values = {
      'author.name': 'Melvin',
      'author.nickname': 'Mel',
      'author.email': 'm@example.com',
      'author.bio': 'Hi',
    };

    const draft = createDraft({ en: { ...values }, fr: { ...values } });

    resetField({ draft, fieldConfig, keyPath: 'author', locale: 'fr' });

    expect(draft.currentValues.fr).toEqual({ ...values, 'author.name': '' });
    // The default locale is left alone, as are the keys of a `duplicate_keys` KeyValue field
    expect(draft.currentValues.en).toEqual(values);
    expect(syncAllDuplicateKeys).not.toHaveBeenCalled();
  });

  test('should clear the duplicated values in the other locales as well', () => {
    const values = {
      'tags.0': 'a',
      'tags.1': 'b',
      'meta.x': '1',
      'labels.0': 'A',
      'author.name': 'Melvin',
      'author.bio': 'Hi',
    };

    const draft = createDraft({ en: { ...values }, fr: { ...values, 'labels.0': 'Â' } });

    resetField({
      draft,
      fieldConfig: { name: 'tags', widget: 'list', i18n: 'duplicate' },
      keyPath: 'tags',
      locale: 'en',
    });
    resetField({
      draft,
      fieldConfig: { name: 'meta', widget: 'keyvalue', i18n: 'duplicate' },
      keyPath: 'meta',
      locale: 'en',
    });
    resetField({
      draft,
      fieldConfig: { name: 'labels', widget: 'list', i18n: true },
      keyPath: 'labels',
      locale: 'en',
    });
    resetField({
      draft,
      fieldConfig: {
        name: 'author',
        widget: 'object',
        i18n: true,
        fields: [
          { name: 'name', widget: 'string', i18n: true },
          { name: 'bio', widget: 'string', i18n: 'duplicate' },
        ],
      },
      keyPath: 'author',
      locale: 'en',
    });

    const cleared = { tags: [], meta: null, labels: [], 'author.name': '', 'author.bio': '' };

    expect(draft.currentValues.en).toEqual(cleared);
    // A translatable field keeps its own values in another locale
    expect(draft.currentValues.fr).toEqual({
      tags: [],
      meta: null,
      'labels.0': 'Â',
      'author.name': 'Melvin',
      'author.bio': '',
    });
  });

  test('should clear a field duplicated along with an ancestor in the other locales', () => {
    const values = { 'venue.name': 'Hall', 'venue.rooms.0': 'r1' };
    const draft = createDraft({ en: { ...values }, fr: { ...values } });

    // The field has no `i18n` option of its own, but its Object field is duplicated
    resetField({
      draft,
      fieldConfig: { name: 'rooms', widget: 'list' },
      keyPath: 'venue.rooms',
      locale: 'en',
    });

    expect(draft.currentValues.en).toEqual({ 'venue.name': 'Hall', 'venue.rooms': [] });
    expect(draft.currentValues.fr).toEqual({ 'venue.name': 'Hall', 'venue.rooms': [] });
  });
});

describe('Test canResetField()', () => {
  test('should tell whether the field holds anything to clear', () => {
    const args = { fieldConfig: authorField, keyPath: 'author', locale: 'en', defaultLocale: 'en' };

    expect(canResetField({ ...args, valueMap: { title: 'Hello', ...authorValues } })).toBe(true);
    // Only the values the user doesn’t enter, which are kept
    expect(
      canResetField({
        ...args,
        valueMap: {
          'author.id': 'x',
          'author.kind': 'person',
          'author.name': '',
          'author.age': null,
          'author.active': false,
          'author.links': [],
          'author.meta': null,
          'author.address.city': '',
          // An internal property or an `undefined` value doesn’t count
          'author.__sc_item_id': 'abc',
          'author.nickname': undefined,
        },
      }),
    ).toBe(false);
  });

  test('should tell whether a List or KeyValue field holds items or pairs', () => {
    const list = { fieldConfig: { name: 'tags', widget: 'list' }, keyPath: 'tags' };
    const meta = { fieldConfig: { name: 'meta', widget: 'keyvalue' }, keyPath: 'meta' };
    const locales = { locale: 'en', defaultLocale: 'en' };

    expect(canResetField({ ...list, ...locales, valueMap: { 'tags.0': '' } })).toBe(true);
    expect(canResetField({ ...list, ...locales, valueMap: { tags: [] } })).toBe(false);
    expect(canResetField({ ...meta, ...locales, valueMap: { 'meta.a': '' } })).toBe(true);
    expect(canResetField({ ...meta, ...locales, valueMap: { meta: null } })).toBe(false);
  });

  test('should keep the items of a List field that doesn’t allow removing or adding them', () => {
    /**
     * Get the arguments for a List field of links with the given options.
     * @param {Record<string, any>} options List options.
     * @returns {any} Arguments.
     */
    const getArgs = (options) => ({
      fieldConfig: {
        name: 'links',
        widget: 'list',
        default: [{ url: '/' }],
        fields: [{ name: 'url', widget: 'string' }],
        ...options,
      },
      keyPath: 'links',
      locale: 'en',
      defaultLocale: 'en',
      valueMap: { links: [], 'links.0.url': '/docs', 'links.1.url': '/blog' },
    });

    // Clearing removes every item
    expect(canResetField(getArgs({ allow_remove: false }))).toBe(false);
    expect(canResetField(getArgs({ allow_add: false }))).toBe(true);
    // Restoring the default value can remove items as well as add them
    expect(canResetField({ ...getArgs({ allow_remove: false }), restore: true })).toBe(false);
    expect(canResetField({ ...getArgs({ allow_add: false }), restore: true })).toBe(false);
    expect(canResetField({ ...getArgs({}), restore: true })).toBe(true);
    // A List field without subfields doesn’t take the options
    expect(
      canResetField({
        ...getArgs({}),
        fieldConfig: { name: 'links', widget: 'list', allow_remove: false },
        valueMap: { links: [], 'links.0': 'a' },
      }),
    ).toBe(true);
  });

  test('should keep a List field that doesn’t allow removing items within an Object field', () => {
    const draft = createDraft({
      en: { 'venue.name': 'Hall', 'venue.rooms': [], 'venue.rooms.0.name': 'East' },
    });

    resetField({
      draft,
      fieldConfig: {
        name: 'venue',
        widget: 'object',
        fields: [
          { name: 'name', widget: 'string' },
          {
            name: 'rooms',
            widget: 'list',
            allow_remove: false,
            fields: [{ name: 'name', widget: 'string' }],
          },
        ],
      },
      keyPath: 'venue',
      locale: 'en',
    });

    expect(draft.currentValues.en).toEqual({
      'venue.name': '',
      'venue.rooms': [],
      'venue.rooms.0.name': 'East',
    });
  });
});

describe('Test resetField() for restoring', () => {
  test('should restore the default values, keeping the ones the user doesn’t enter', () => {
    const draft = createDraft({ en: { title: 'Hello', ...authorValues } });

    resetField({ draft, fieldConfig: authorField, keyPath: 'author', locale: 'en', restore: true });

    // A required List field limited to one item gets its item back
    expect(draft.currentValues.en).toEqual({
      title: 'Hello',
      'author.id': '0b8b6c2e-5b52-4f4e-9d59-0f7b6a1c2d3e',
      'author.kind': 'person',
      'author.slug': 'melvin',
      'author.code': 'M1',
      'author.name': 'Anonymous',
      'author.age': null,
      'author.active': true,
      'author.links': [],
      'author.links.0.url': '',
      'author.meta.': '',
      'author.address.city': '',
    });
  });

  test('should take the default value of the Object field as a whole into account', () => {
    /** @type {Field} */
    const fieldConfig = {
      name: 'venue',
      widget: 'object',
      default: { name: 'Hall' },
      fields: [
        { name: 'name', widget: 'string', default: 'Room' },
        { name: 'city', widget: 'string', default: 'Toronto' },
      ],
    };

    const draft = createDraft({ en: { 'venue.name': 'Arena', 'venue.city': 'Ottawa' } });

    resetField({ draft, fieldConfig, keyPath: 'venue', locale: 'en', restore: true });

    expect(draft.currentValues.en).toEqual({ 'venue.name': 'Hall', 'venue.city': 'Toronto' });
  });

  test('should tell whether the field holds anything but the default values', () => {
    /** @type {Field} */
    const fieldConfig = { name: 'tags', widget: 'list', default: ['a'] };
    const args = { fieldConfig, keyPath: 'tags', locale: 'en', defaultLocale: 'en', restore: true };

    expect(canResetField({ ...args, valueMap: { tags: [], 'tags.0': 'b' } })).toBe(true);
    expect(canResetField({ ...args, valueMap: { tags: [], 'tags.0': 'a' } })).toBe(false);
  });
});

describe('Test resetEntry() and canResetEntry()', () => {
  /** @type {Field[]} */
  const fields = [
    { name: 'title', widget: 'string', i18n: true, default: 'Untitled' },
    { name: 'tags', widget: 'list', i18n: 'duplicate' },
    { name: 'id', widget: 'uuid' },
  ];

  /**
   * Create a draft of an English and French entry.
   * @param {Record<string, boolean>} [currentLocales] Enabled locales.
   * @returns {EntryDraft} Draft.
   */
  const createEntryDraft = (currentLocales = { en: true, fr: true }) =>
    /** @type {EntryDraft} */ (
      /** @type {unknown} */ ({
        ...createDraft({
          en: { title: 'Hello', 'tags.0': 'a', id: 'x' },
          fr: { title: 'Bonjour', 'tags.0': 'a', id: 'x', 'title.__sc_item_id': 'y' },
        }),
        fields,
        currentLocales,
      })
    );

  test('should reset every field in every enabled locale', () => {
    const draft = createEntryDraft();

    expect(canResetEntry({ draft })).toBe(true);
    resetEntry({ draft });

    expect(draft.currentValues.en).toEqual({ title: '', tags: [], id: 'x' });
    expect(draft.currentValues.fr).toMatchObject({ title: '', tags: [], id: 'x' });
    expect(canResetEntry({ draft })).toBe(false);
    expect(syncAllDuplicateKeys).toHaveBeenCalledOnce();

    resetEntry({ draft, restore: true });
    expect(draft.currentValues.en).toEqual({ title: 'Untitled', tags: [], id: 'x' });
    // The translated field gets its default in French too, and the duplicated one follows English
    expect(draft.currentValues.fr).toMatchObject({ title: 'Untitled', tags: [], id: 'x' });
  });

  test('should reset every field in a locale, leaving a disabled locale alone', () => {
    const draft = createEntryDraft({ en: true, fr: false });

    resetEntry({ draft });
    // The duplicated field follows the default locale all the same
    expect(draft.currentValues.fr).toMatchObject({ title: 'Bonjour', tags: [] });

    vi.mocked(syncAllDuplicateKeys).mockClear();

    const other = createEntryDraft();

    expect(canResetEntry({ draft: other, locale: 'fr', restore: true })).toBe(true);
    resetEntry({ draft: other, locale: 'fr', restore: true });

    // Only the translatable field changes in another locale
    expect(other.currentValues.fr).toMatchObject({ title: 'Untitled', 'tags.0': 'a' });
    expect(other.currentValues.en).toEqual({ title: 'Hello', 'tags.0': 'a', id: 'x' });
    expect(syncAllDuplicateKeys).not.toHaveBeenCalled();
  });
});
