// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Collection with an Object field of variable types, and a translatable List field whose items of
 * either type hold an Object field of the same name but with other subfields.
 */
const collection = {
  name: 'posts',
  _type: 'entry',
  fields: [
    { name: 'title', widget: 'string', i18n: true },
    {
      name: 'block',
      widget: 'object',
      i18n: true,
      required: false,
      types: [
        {
          name: 'a',
          fields: [
            { name: 'alpha', widget: 'string', i18n: true },
            { name: 'num', widget: 'number', i18n: true },
          ],
        },
        { name: 'b', fields: [{ name: 'beta', widget: 'string', i18n: true }] },
      ],
    },
    {
      name: 'blocks',
      widget: 'list',
      i18n: true,
      types: [
        {
          name: 'photo',
          fields: [
            {
              name: 'media',
              widget: 'object',
              i18n: true,
              required: false,
              fields: [
                { name: 'src', widget: 'string', i18n: 'duplicate' },
                { name: 'alt', widget: 'string', i18n: true },
              ],
            },
          ],
        },
        {
          name: 'video',
          fields: [
            {
              name: 'media',
              widget: 'object',
              i18n: true,
              required: false,
              fields: [
                { name: 'url', widget: 'string', i18n: 'duplicate' },
                { name: 'duration', widget: 'number', i18n: true },
              ],
            },
          ],
        },
      ],
    },
  ],
  _i18n: {
    i18nEnabled: true,
    allLocales: ['en', 'fr'],
    initialLocales: ['en', 'fr'],
    defaultLocale: 'en',
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

const { fieldConfigCacheMap, getField } = await import('$lib/services/contents/entry/fields');
const { createProxy } = await import('$lib/services/contents/draft/create/proxy.svelte');
const { addObjectFields } = await import('$lib/services/contents/draft/update/object');

describe('contents/draft/update/object (integration)', () => {
  /**
   * Create a draft with a value proxy for each locale.
   * @param {Record<string, object>} values Initial values per locale.
   * @returns {object} Draft.
   */
  const createDraft = (values) => {
    const draft = {
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      collection,
      fields: collection.fields,
      defaultLocale: 'en',
      currentValues: {},
      validities: { en: {}, fr: {} },
    };

    Object.entries(values).forEach(([locale, target]) => {
      draft.currentValues[locale] = createProxy({ draft, locale, target });
    });

    return draft;
  };

  /**
   * Add the subfields of an Object field in the French locale.
   * @param {object} draft Draft.
   * @param {string} keyPath Key path of the Object field.
   * @param {string} [type] Variable type name.
   */
  const addInFrench = (draft, keyPath, type) => {
    const valueMap = draft.currentValues.fr;
    const fieldConfig = getField({ collectionName: 'posts', keyPath, valueMap });

    addObjectFields({ draft, locale: 'fr', keyPath, fieldConfig, type });
  };

  beforeEach(() => {
    fieldConfigCacheMap.clear();
  });

  it('should only add the subfields of the chosen type in another locale', () => {
    const draft = createDraft({
      en: { title: 'Hello', 'block.type': 'a', 'block.alpha': 'Hello', 'block.num': 5 },
      fr: { title: 'Bonjour', block: null },
    });

    addInFrench(draft, 'block', 'b');

    expect({ ...draft.currentValues.fr }).toEqual({
      title: 'Bonjour',
      'block.type': 'b',
      'block.beta': '',
    });
    expect({ ...draft.currentValues.en }).toEqual({
      title: 'Hello',
      'block.type': 'a',
      'block.alpha': 'Hello',
      'block.num': 5,
    });
  });

  it('should copy the default locale’s values of an object of the same type', () => {
    const draft = createDraft({
      en: { 'block.type': 'a', 'block.alpha': 'Hello', 'block.num': 5 },
      fr: { block: null },
    });

    addInFrench(draft, 'block', 'a');

    // A translatable text is left for the user to fill in, unlike a number
    expect({ ...draft.currentValues.fr }).toEqual({
      'block.type': 'a',
      'block.alpha': '',
      'block.num': 5,
    });
  });

  it('should not copy the values of an object in a list item of another type', () => {
    const draft = createDraft({
      en: { 'blocks.0.type': 'video', 'blocks.0.media.url': 'a.mp4', 'blocks.0.media.duration': 3 },
      fr: { 'blocks.0.type': 'photo', 'blocks.0.media': null },
    });

    addInFrench(draft, 'blocks.0.media');

    expect({ ...draft.currentValues.fr }).toEqual({
      'blocks.0.type': 'photo',
      'blocks.0.media.src': '',
      'blocks.0.media.alt': '',
    });
  });

  it('should copy the values of an object in a list item of the same type', () => {
    const draft = createDraft({
      en: { 'blocks.0.type': 'photo', 'blocks.0.media.src': 'a.png', 'blocks.0.media.alt': 'A' },
      fr: { 'blocks.0.type': 'photo', 'blocks.0.media': null },
    });

    addInFrench(draft, 'blocks.0.media');

    expect({ ...draft.currentValues.fr }).toEqual({
      'blocks.0.type': 'photo',
      'blocks.0.media.src': 'a.png',
      'blocks.0.media.alt': '',
    });
  });
});
