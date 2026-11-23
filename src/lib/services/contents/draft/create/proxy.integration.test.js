// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Collection with a translatable List field whose variable types have subfields of their own, one
 * of which is duplicated.
 * @see https://github.com/sveltia/sveltia-cms/issues/1075
 */
const collection = {
  name: 'pages',
  _type: 'entry',
  fields: [
    { name: 'title', widget: 'string', i18n: true },
    {
      name: 'blocks',
      widget: 'list',
      i18n: true,
      types: [
        { name: 'quote', fields: [{ name: 'text', widget: 'text', i18n: true }] },
        { name: 'latest', fields: [{ name: 'limit', widget: 'number', i18n: 'duplicate' }] },
      ],
    },
    {
      name: 'links',
      widget: 'list',
      i18n: 'duplicate',
      fields: [{ name: 'url', widget: 'string' }],
    },
    // Fields storing their value under key paths without a field configuration of their own
    { name: 'tags', widget: 'list', i18n: 'duplicate' },
    { name: 'meta', widget: 'keyvalue', i18n: 'duplicate' },
    { name: 'snippet', widget: 'code', i18n: 'duplicate' },
    { name: 'synced_tags', widget: 'list', i18n: 'sync' },
    { name: 'synced_meta', widget: 'keyvalue', i18n: 'sync' },
    { name: 'synced_snippet', widget: 'code', i18n: 'sync' },
    { name: 'code_only', widget: 'code', i18n: 'duplicate', output_code_only: true },
    { name: 'labels', widget: 'list', i18n: true },
  ],
  _i18n: {
    i18nEnabled: true,
    allLocales: ['fr', 'en'],
    initialLocales: ['fr', 'en'],
    defaultLocale: 'fr',
    canonicalSlug: { key: 'translationKey' },
  },
};

vi.mock('$lib/services/contents/collection', async (importOriginal) => ({
  ...(await importOriginal()),
  getCollection: vi.fn(() => collection),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('$lib/services/contents/draft/validate/fields', () => ({
  revalidateField: vi.fn(),
}));

// Load the collection files module first, for the same reason as in the normalize integration test
await import('$lib/services/contents/collection/files');

const { fieldConfigCacheMap } = await import('$lib/services/contents/entry/fields');
const { createProxy } = await import('$lib/services/contents/draft/create/proxy.svelte');
const { updateNonPrimitiveValue } = await import('$lib/services/contents/draft/update');
const { revertChanges } = await import('$lib/services/contents/draft/update/revert');

describe('contents/draft/create/proxy (integration)', () => {
  /**
   * Create a draft with a value proxy for each locale.
   * @param {Record<string, object>} values Initial values per locale.
   * @returns {object} Draft.
   */
  const createDraft = (values) => {
    const draft = {
      collectionName: 'pages',
      fileName: undefined,
      isIndexFile: false,
      currentValues: {},
      validities: { fr: {}, en: {} },
    };

    Object.entries(values).forEach(([locale, target]) => {
      draft.currentValues[locale] = createProxy({ draft, locale, target });
    });

    return draft;
  };

  beforeEach(() => {
    fieldConfigCacheMap.clear();
  });

  it('should not copy a duplicated subfield to a list item missing in another locale', () => {
    const draft = createDraft({
      fr: {
        title: 'Titre',
        'blocks.0.type': 'quote',
        'blocks.0.text': 'Citation',
        'blocks.1.type': 'latest',
        'blocks.1.limit': 1,
      },
      en: { title: 'Title' },
    });

    draft.currentValues.fr['blocks.1.limit'] = 3;

    expect({ ...draft.currentValues.en }).toEqual({ title: 'Title' });
  });

  it('should not copy a duplicated subfield to a list item of another type', () => {
    const draft = createDraft({
      fr: {
        'blocks.0.type': 'quote',
        'blocks.0.text': 'Citation',
        'blocks.1.type': 'latest',
        'blocks.1.limit': 1,
      },
      en: { 'blocks.0.type': 'quote', 'blocks.0.text': 'Quote' },
    });

    draft.currentValues.fr['blocks.0.text'] = 'Autre citation';
    draft.currentValues.fr['blocks.1.limit'] = 3;

    expect({ ...draft.currentValues.en }).toEqual({
      'blocks.0.type': 'quote',
      'blocks.0.text': 'Quote',
    });

    const other = createDraft({
      fr: { 'blocks.0.type': 'latest', 'blocks.0.limit': 1 },
      en: { 'blocks.0.type': 'quote', 'blocks.0.text': 'Quote' },
    });

    other.currentValues.fr['blocks.0.limit'] = 3;

    expect({ ...other.currentValues.en }).toEqual({
      'blocks.0.type': 'quote',
      'blocks.0.text': 'Quote',
    });
  });

  it('should copy a duplicated subfield to the same list item in another locale', () => {
    const draft = createDraft({
      fr: { 'blocks.0.type': 'latest', 'blocks.0.limit': 1 },
      en: { 'blocks.0.type': 'latest', 'blocks.0.limit': 1 },
    });

    draft.currentValues.fr['blocks.0.limit'] = 3;

    expect(draft.currentValues.en['blocks.0.limit']).toBe(3);

    delete draft.currentValues.fr['blocks.0.limit'];

    expect('blocks.0.limit' in draft.currentValues.en).toBe(false);
  });

  it('should not delete a duplicated subfield from a list item of another type', () => {
    const draft = createDraft({
      fr: { 'blocks.0.type': 'latest', 'blocks.0.limit': 1 },
      en: { 'blocks.0.type': 'quote', 'blocks.0.limit': 1 },
    });

    delete draft.currentValues.fr['blocks.0.limit'];

    expect(draft.currentValues.en['blocks.0.limit']).toBe(1);
  });

  it('should copy the items of a duplicated list by position', () => {
    const draft = createDraft({ fr: { 'links.0.url': 'a' }, en: {} });

    draft.currentValues.fr['links.0.url'] = 'b';

    expect(draft.currentValues.en['links.0.url']).toBe('b');
  });

  it('should not write a duplicated non-primitive value to a list item missing elsewhere', () => {
    const draft = createDraft({
      fr: { 'blocks.0.type': 'latest', 'blocks.0.limit': 1 },
      en: {},
    });

    updateNonPrimitiveValue({
      draft,
      valueStoreKey: 'currentValues',
      locale: 'fr',
      keyPath: 'blocks.0.limit',
      i18n: 'duplicate',
      value: [3],
    });

    expect({ ...draft.currentValues.en }).toEqual({});
  });

  describe('a value without a field of its own', () => {
    // An item of a List field without subfields, a KeyValue pair, and the code and language of a
    // Code field are stored under key paths that `getField()` doesn’t resolve, and are copied along
    // with the field owning them
    const values = {
      'tags.0': 'a',
      'meta.key': 'v',
      snippet: {},
      'snippet.code': 'x',
      'snippet.lang': 'js',
    };

    it('should copy a duplicated value written in the default locale', () => {
      const draft = createDraft({ fr: { ...values }, en: { ...values } });

      draft.currentValues.fr['tags.1'] = 'b';
      draft.currentValues.fr['meta.key'] = 'w';
      // What the Code field editor writes
      Object.assign(draft.currentValues.fr, { snippet: {}, 'snippet.code': 'y' });

      expect({ ...draft.currentValues.en }).toEqual({
        ...values,
        'tags.1': 'b',
        'meta.key': 'w',
        'snippet.code': 'y',
      });

      delete draft.currentValues.fr['tags.1'];
      delete draft.currentValues.fr['meta.key'];

      const { 'meta.key': _deleted, ...remaining } = values;

      expect({ ...draft.currentValues.en }).toEqual({ ...remaining, 'snippet.code': 'y' });

      // A duplicated field can’t be edited in another locale
      draft.currentValues.en['snippet.code'] = 'z';

      expect(draft.currentValues.fr['snippet.code']).toBe('y');
    });

    it('should copy a synced value written in any locale', () => {
      const synced = {
        'synced_tags.0': 'a',
        'synced_meta.key': 'v',
        synced_snippet: {},
        'synced_snippet.code': 'x',
      };

      const draft = createDraft({ fr: { ...synced }, en: { ...synced } });

      draft.currentValues.en['synced_tags.0'] = 'b';
      draft.currentValues.en['synced_meta.key'] = 'w';
      Object.assign(draft.currentValues.en, { synced_snippet: {}, 'synced_snippet.lang': 'py' });

      expect({ ...draft.currentValues.fr }).toEqual({
        ...synced,
        'synced_tags.0': 'b',
        'synced_meta.key': 'w',
        'synced_snippet.lang': 'py',
      });

      delete draft.currentValues.en['synced_meta.key'];

      expect('synced_meta.key' in draft.currentValues.fr).toBe(false);
    });

    it('should not copy a value that no field owns', () => {
      const draft = createDraft({
        fr: { 'labels.0': 'a', 'links.0.url': 'a', code_only: 'x' },
        en: { 'labels.0': 'b', 'links.0.url': 'a', code_only: 'x' },
      });

      // A translatable list
      draft.currentValues.fr['labels.0'] = 'c';
      // A stray value in an item of a List field with subfields, one under a Code field that only
      // outputs the code, one under a List field that isn’t an item, and an unknown field
      draft.currentValues.fr['links.0.unknown'] = 'c';
      draft.currentValues.fr['code_only.code'] = 'c';
      draft.currentValues.fr['tags.extra'] = 'c';
      draft.currentValues.fr.unknown = 'c';

      expect({ ...draft.currentValues.en }).toEqual({
        'labels.0': 'b',
        'links.0.url': 'a',
        code_only: 'x',
      });
    });

    it('should revert a duplicated value in every locale when reverted in the default locale', () => {
      const draft = createDraft({ fr: { ...values }, en: { ...values } });

      Object.assign(draft, {
        collection,
        fields: collection.fields,
        originalValues: { fr: { ...values }, en: { ...values } },
      });

      updateNonPrimitiveValue({
        draft,
        valueStoreKey: 'currentValues',
        locale: 'fr',
        keyPath: 'tags',
        i18n: 'duplicate',
        value: ['b', 'c'],
      });
      draft.currentValues.fr['meta.key'] = 'w';
      draft.currentValues.fr['snippet.code'] = 'y';

      revertChanges({ draft, locale: 'fr', keyPath: 'tags' });
      revertChanges({ draft, locale: 'fr', keyPath: 'meta' });
      revertChanges({ draft, locale: 'fr', keyPath: 'snippet' });

      expect({ ...draft.currentValues.fr }).toEqual(values);
      expect({ ...draft.currentValues.en }).toEqual(values);
    });
  });
});
