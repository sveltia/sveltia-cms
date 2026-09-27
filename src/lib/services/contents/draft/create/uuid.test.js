import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fillUuidValues } from './uuid';

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

const { getField } = await import('$lib/services/contents/entry/fields');

/** @type {Record<string, any>} */
const fields = {
  title: { name: 'title', widget: 'string', i18n: true },
  uid_translate: { name: 'uid_translate', widget: 'uuid', i18n: true },
  uid_alias: { name: 'uid_alias', widget: 'uuid', i18n: 'translate' },
  uid_duplicate: { name: 'uid_duplicate', widget: 'uuid', i18n: 'duplicate' },
  uid_plain: { name: 'uid_plain', widget: 'uuid' },
  uid_prefixed: { name: 'uid_prefixed', widget: 'uuid', prefix: 'post-' },
  'items.0.id': { name: 'id', widget: 'uuid', i18n: 'duplicate' },
  blocks: { name: 'blocks', widget: 'list', i18n: 'duplicate' },
  meta: { name: 'meta', widget: 'object', i18n: 'duplicate' },
  'meta.id': { name: 'id', widget: 'uuid' },
  'blocks.0.meta.id': { name: 'id', widget: 'uuid' },
  'blocks.1.meta.id': { name: 'id', widget: 'uuid' },
  'blocks.0.id': { name: 'id', widget: 'uuid' },
  'blocks.1.id': { name: 'id', widget: 'uuid' },
  'blocks.0.name': { name: 'name', widget: 'string' },
  'blocks.0.ref': { name: 'ref', widget: 'uuid', i18n: true },
};

const UUID_REGEX = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;
const getFieldArgs = { collectionName: 'posts', fileName: undefined, isIndexFile: false };

describe('fillUuidValues()', () => {
  beforeEach(() => {
    vi.mocked(getField).mockImplementation(({ keyPath }) => fields[keyPath]);
  });

  test('gives each locale where the field is editable a UUID of its own', () => {
    /** @type {Record<string, Record<string, any>>} */
    const contentMap = {
      // Non-default locales listed first are still filled in after the default locale
      fr: { title: '', uid_translate: '', uid_alias: '', uid_duplicate: '' },
      ja: { uid_duplicate: '' },
      en: { title: '', uid_translate: '', uid_alias: '', uid_duplicate: '', uid_plain: '' },
    };

    fillUuidValues({ contentMap, defaultLocale: 'en', getFieldArgs });

    const { en, fr } = contentMap;

    expect(en.title).toBe('');
    expect(fr.title).toBe('');
    [en.uid_translate, en.uid_alias, en.uid_duplicate, en.uid_plain].forEach((value) => {
      expect(value).toMatch(UUID_REGEX);
    });
    // A translatable field gets a UUID of its own in every locale
    expect(fr.uid_translate).toMatch(UUID_REGEX);
    expect(fr.uid_translate).not.toBe(en.uid_translate);
    expect(fr.uid_alias).toMatch(UUID_REGEX);
    expect(fr.uid_alias).not.toBe(en.uid_alias);
    // A duplicated field takes the default locale’s value
    expect(fr.uid_duplicate).toBe(en.uid_duplicate);
    expect(contentMap.ja.uid_duplicate).toBe(en.uid_duplicate);
  });

  test('fills in the nested fields and keeps the options of the field', () => {
    /** @type {Record<string, Record<string, any>>} */
    const contentMap = {
      en: { 'items.0.id': '', uid_prefixed: '' },
      ja: { 'items.0.id': '' },
    };

    fillUuidValues({ contentMap, defaultLocale: 'en', getFieldArgs });

    expect(contentMap.en['items.0.id']).toMatch(UUID_REGEX);
    expect(contentMap.ja['items.0.id']).toBe(contentMap.en['items.0.id']);
    expect(contentMap.en.uid_prefixed).toMatch(/^post-[\da-f-]{36}$/);
    expect(getField).toHaveBeenCalledWith({
      ...getFieldArgs,
      keyPath: 'items.0.id',
      valueMap: contentMap.ja,
    });
  });

  test('copies a UUID nested in a duplicated field to the items the locale has', () => {
    /** @type {Record<string, Record<string, any>>} */
    const contentMap = {
      en: { 'blocks.0.id': '', 'blocks.0.name': 'a', 'blocks.0.ref': '', 'blocks.1.id': '' },
      // The subfields without an `i18n` option of their own aren’t among the locale’s defaults,
      // and the second item isn’t there at all
      ja: { 'blocks.0.name': 'a', 'blocks.0.ref': '' },
    };

    fillUuidValues({ contentMap, defaultLocale: 'en', getFieldArgs });

    const { en, ja } = contentMap;

    expect(en['blocks.0.id']).toMatch(UUID_REGEX);
    expect(en['blocks.1.id']).toMatch(UUID_REGEX);
    expect(ja['blocks.0.id']).toBe(en['blocks.0.id']);
    expect('blocks.1.id' in ja).toBe(false);
    // A subfield explicitly made translatable gets a UUID of its own
    expect(ja['blocks.0.ref']).toMatch(UUID_REGEX);
    expect(ja['blocks.0.ref']).not.toBe(en['blocks.0.ref']);
  });

  test('copies a UUID nested in a duplicated object, which the locale has no keys of', () => {
    /** @type {Record<string, Record<string, any>>} */
    const contentMap = {
      en: { 'meta.id': '', 'blocks.0.meta.id': '', 'blocks.1.meta.id': '' },
      ja: { 'blocks.0.name': 'a' },
    };

    fillUuidValues({ contentMap, defaultLocale: 'en', getFieldArgs });

    const { en, ja } = contentMap;

    expect(ja['meta.id']).toBe(en['meta.id']);
    // An object in a list item is only there if the item is
    expect(ja['blocks.0.meta.id']).toBe(en['blocks.0.meta.id']);
    expect('blocks.1.meta.id' in ja).toBe(false);
  });

  test('keeps a value that is already there', () => {
    /** @type {Record<string, Record<string, any>>} */
    const contentMap = {
      en: { uid_translate: 'given', uid_duplicate: 'shared' },
      fr: { uid_translate: 'donné', uid_duplicate: '' },
    };

    fillUuidValues({ contentMap, defaultLocale: 'en', getFieldArgs });

    expect(contentMap).toEqual({
      en: { uid_translate: 'given', uid_duplicate: 'shared' },
      fr: { uid_translate: 'donné', uid_duplicate: 'shared' },
    });
  });

  test('leaves a duplicated field empty without a default locale value to copy', () => {
    /** @type {Record<string, Record<string, any>>} */
    const contentMap = { fr: { uid_duplicate: '' } };

    fillUuidValues({ contentMap, defaultLocale: 'en', getFieldArgs });

    expect(contentMap.fr.uid_duplicate).toBe('');
  });
});
