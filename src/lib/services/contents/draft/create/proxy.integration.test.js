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
});
