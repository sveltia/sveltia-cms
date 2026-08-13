// @ts-nocheck
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Collection whose configuration has outgrown the entry below: `chargeSpeed` was optional when the
 * entry was written and is now required, and `featured` was added later.
 */
const collection = {
  name: 'chargerModels',
  _type: 'entry',
  fields: [
    { name: 'name', widget: 'string' },
    { name: 'chargeSpeed', widget: 'select', options: ['50kW', '240kW'] },
    { name: 'featured', widget: 'boolean', required: false, default: true },
  ],
  _i18n: {
    i18nEnabled: false,
    allLocales: ['_default'],
    initialLocales: ['_default'],
    defaultLocale: '_default',
    canonicalSlug: { key: 'translationKey' },
  },
  editor: { preview: false },
  _file: { format: 'yaml' },
};

const originalEntry = {
  id: 'entry-1',
  slug: 'ev-ultra',
  locales: { _default: { slug: 'ev-ultra', content: { name: 'EV Ultra 240S' } } },
};

vi.mock('$lib/services/contents/collection', async (importOriginal) => ({
  ...(await importOriginal()),
  getCollection: vi.fn(() => collection),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { subscribe: vi.fn(() => () => {}) },
}));

vi.mock('$lib/services/contents/draft/backup', () => ({
  restoreBackupIfNeeded: vi.fn(),
}));

const { getCollection } = await import('$lib/services/contents/collection');
const { fieldConfigCacheMap } = await import('$lib/services/contents/entry/fields');
const { createDraft } = await import('$lib/services/contents/draft/create');
const { entryDraft } = await import('$lib/services/contents/draft');
const { validateEntry } = await import('$lib/services/contents/draft/validate');
const { serializeContent } = await import('$lib/services/contents/draft/save/serialize');

describe('contents/draft/create/normalize (integration)', () => {
  beforeEach(() => {
    createDraft({ collection, originalEntry });
  });

  it('should load an existing entry with the values missing from the file filled in', () => {
    // https://github.com/sveltia/sveltia-cms/issues/650
    expect(get(entryDraft).currentValues._default).toEqual({
      name: 'EV Ultra 240S',
      chargeSpeed: '',
      featured: true,
    });

    // The filled-in values are part of the original values as well, so the entry isn’t reported as
    // modified just for having been opened
    expect(get(entryDraft).originalValues._default).toEqual(get(entryDraft).currentValues._default);
  });

  it('should apply the new validation rules to an existing entry', () => {
    // https://github.com/sveltia/sveltia-cms/issues/395
    expect(validateEntry()).toBe(false);
    expect(get(entryDraft).validities._default.chargeSpeed.valueMissing).toBe(true);

    get(entryDraft).currentValues._default.chargeSpeed = '240kW';

    expect(validateEntry()).toBe(true);
  });

  it('should keep a hand-written entry’s mistyped values from destroying the output', () => {
    // https://github.com/decaporg/decap-cms/issues/836
    // https://github.com/decaporg/decap-cms/issues/3524
    const shapeCollection = {
      ...collection,
      fields: [
        { name: 'name', widget: 'string' },
        {
          name: 'author',
          widget: 'object',
          fields: [
            { name: 'name', widget: 'string' },
            { name: 'email', widget: 'string', required: false },
          ],
        },
        { name: 'tags', widget: 'list', fields: [{ name: 'label', widget: 'string' }] },
      ],
    };

    getCollection.mockReturnValue(shapeCollection);
    fieldConfigCacheMap.clear();

    createDraft({
      collection: shapeCollection,
      originalEntry: {
        id: 'entry-2',
        slug: 'hand-written',
        locales: {
          _default: {
            slug: 'hand-written',
            // An Object field holding a plain string and a List field holding bare strings, both of
            // which `unflatten()` would let win over anything the editor writes below them
            content: { name: 42, author: 'Me', 'tags.0': 'news' },
          },
        },
      },
    });

    const draft = get(entryDraft);

    draft.currentValues._default['author.name'] = 'Me';
    draft.currentValues._default['tags.0.label'] = 'News';

    expect(
      serializeContent({ draft, locale: '_default', valueMap: draft.currentValues._default }),
    ).toEqual({
      name: '42',
      author: { name: 'Me', email: '' },
      tags: [{ label: 'News' }],
    });
  });
});
