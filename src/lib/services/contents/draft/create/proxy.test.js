// @ts-nocheck
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { copyDefaultLocaleValue, createProxy, getValueMapVersion } from './proxy.svelte.js';

const { getCollection, getCollectionFile, getField, revalidateField, isAutoDuplicationEnabled } =
  vi.hoisted(() => ({
    getCollection: vi.fn(),
    getCollectionFile: vi.fn(),
    getField: vi.fn(),
    revalidateField: vi.fn(),
    isAutoDuplicationEnabled: vi.fn(() => true),
  }));

vi.mock('$lib/services/contents/collection', () => ({ getCollection }));
vi.mock('$lib/services/contents/collection/files', () => ({ getCollectionFile }));
vi.mock('$lib/services/contents/draft', () => ({ isAutoDuplicationEnabled }));
vi.mock('$lib/services/contents/entry/fields', () => ({ getField }));
vi.mock('$lib/services/contents/draft/validate/fields', () => ({ revalidateField }));

/**
 * Create a minimal draft with the given locales, each holding a value proxy.
 * @param {object} [options] Options.
 * @param {string[]} [options.locales] Locales.
 * @param {string} [options.fileName] Collection file name.
 * @param {Record<string, object>} [options.values] Initial values per locale.
 * @returns {object} Draft.
 */
const createDraft = ({ locales = ['en', 'ja'], fileName = undefined, values = {} } = {}) => {
  const draft = {
    collectionName: 'posts',
    fileName,
    isIndexFile: false,
    currentValues: {},
    validities: Object.fromEntries(locales.map((locale) => [locale, {}])),
  };

  locales.forEach((locale) => {
    draft.currentValues[locale] = createProxy({ draft, locale, target: values[locale] ?? {} });
  });

  return draft;
};

describe('contents/draft/create/proxy.svelte', () => {
  beforeEach(() => {
    getCollection.mockReturnValue({
      name: 'posts',
      _i18n: { defaultLocale: 'en', canonicalSlug: { key: 'translationKey' } },
    });
    getCollectionFile.mockReturnValue(undefined);
    getField.mockReturnValue(undefined);
    isAutoDuplicationEnabled.mockReturnValue(true);
  });

  describe('copyDefaultLocaleValue', () => {
    /**
     * Run {@link copyDefaultLocaleValue} against a draft made of plain value maps.
     * @param {Record<string, object>} currentValues Values per locale.
     * @param {object} args Arguments other than the draft.
     */
    const copy = (currentValues, args) => {
      copyDefaultLocaleValue({ draft: { currentValues }, ...args });
    };

    it('should copy value to other locales but not the source locale', () => {
      const currentValues = { en: { title: 'Original' }, fr: {}, de: {} };

      copy(currentValues, {
        getFieldArgs: { keyPath: 'title' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'Hello World',
      });

      expect(currentValues.en.title).toBe('Original');
      expect(currentValues.fr.title).toBe('Hello World');
      expect(currentValues.de.title).toBe('Hello World');
    });

    it('should not copy if parent object does not exist in nested keyPath', () => {
      const currentValues = { en: { 'parent.child': 'value' }, fr: {} };

      copy(currentValues, {
        getFieldArgs: { keyPath: 'parent.child' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'nested value',
      });

      expect(currentValues.fr['parent.child']).toBeUndefined();
    });

    it('should copy if parent object exists in nested keyPath', () => {
      const currentValues = { en: { 'parent.child': 'value' }, fr: { 'parent.other': 'x' } };

      copy(currentValues, {
        getFieldArgs: { keyPath: 'parent.child' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'nested value',
      });

      expect(currentValues.fr['parent.child']).toBe('nested value');
    });

    it('should copy if parent field exists via getField', () => {
      const currentValues = { en: { 'parent.child': 'value' }, fr: {} };

      getField.mockImplementation(({ keyPath }) =>
        keyPath === 'parent' ? { widget: 'object' } : undefined,
      );

      copy(currentValues, {
        getFieldArgs: { keyPath: 'parent.child', collectionName: 'posts' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'nested value',
      });

      expect(currentValues.fr['parent.child']).toBe('nested value');
    });

    it('should localize a relation value with the {{locale}} template for every locale', () => {
      const currentValues = { en: {}, fr: {}, es: {} };

      copy(currentValues, {
        getFieldArgs: { keyPath: 'related' },
        fieldConfig: { widget: 'relation', value_field: '{{locale}}/{{slug}}' },
        sourceLanguage: 'en',
        value: 'en/my-post',
      });

      // Every locale gets its own prefix; the source value must not be mutated in the loop
      expect(currentValues.fr.related).toBe('fr/my-post');
      expect(currentValues.es.related).toBe('es/my-post');
    });

    it('should leave a non-string relation value alone', () => {
      const currentValues = { en: {}, fr: {} };

      copy(currentValues, {
        getFieldArgs: { keyPath: 'related' },
        fieldConfig: { widget: 'relation', value_field: '{{locale}}/{{slug}}' },
        sourceLanguage: 'en',
        value: undefined,
      });

      expect(currentValues.fr.related).toBeUndefined();
    });

    it('should copy a relation value as is without the {{locale}} template', () => {
      const currentValues = { en: {}, fr: {} };

      copy(currentValues, {
        getFieldArgs: { keyPath: 'related' },
        fieldConfig: { widget: 'relation', value_field: '{{slug}}' },
        sourceLanguage: 'en',
        value: 'my-post',
      });

      expect(currentValues.fr.related).toBe('my-post');

      copy(currentValues, {
        getFieldArgs: { keyPath: 'other' },
        fieldConfig: { widget: 'relation' },
        sourceLanguage: 'en',
        value: 'other-post',
      });

      expect(currentValues.fr.other).toBe('other-post');
    });

    it('should not modify a relation value that does not start with the source locale', () => {
      const currentValues = { en: {}, fr: {} };

      copy(currentValues, {
        getFieldArgs: { keyPath: 'slug' },
        fieldConfig: { widget: 'relation', value_field: '{{locale}}/{{slug}}' },
        sourceLanguage: 'en',
        value: 'de/foreign-slug',
      });

      expect(currentValues.fr.slug).toBe('de/foreign-slug');
    });

    it('should overwrite a different value and skip an equal one', () => {
      const fr = { title: 'Same' };
      const setSpy = vi.fn();
      const currentValues = { en: {}, fr: new Proxy(fr, { set: setSpy }) };

      copy(currentValues, {
        getFieldArgs: { keyPath: 'title' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'Same',
      });

      expect(setSpy).not.toHaveBeenCalled();

      currentValues.fr = {};

      copy(currentValues, {
        getFieldArgs: { keyPath: 'title' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'New Value',
      });

      expect(currentValues.fr.title).toBe('New Value');
    });
  });

  describe('createProxy', () => {
    it('should return undefined if collection not found', () => {
      getCollection.mockReturnValue(undefined);

      const draft = { collectionName: 'nonexistent', fileName: undefined, isIndexFile: false };

      expect(createProxy({ draft, locale: 'en', target: {} })).toBeUndefined();
    });

    it('should return undefined if collection file not found when fileName is provided', () => {
      const draft = { collectionName: 'posts', fileName: 'about', isIndexFile: false };

      expect(createProxy({ draft, locale: 'en', target: {} })).toBeUndefined();
    });

    it('should hold the initial values and reflect updates', () => {
      const draft = createDraft({ values: { en: { title: 'Initial' } } });
      const proxy = draft.currentValues.en;

      expect(proxy.title).toBe('Initial');

      proxy.title = 'Updated';

      expect(proxy.title).toBe('Updated');
      expect(Object.keys(proxy)).toEqual(['title']);
    });

    it('should list the keys in insertion order, even after a key is deleted and re-added', () => {
      // Svelte’s `$state` proxy keeps a deleted key in its target, so the key would otherwise come
      // back in its old position, which reorders KeyValue pairs when one is renamed
      const draft = createDraft({ values: { en: { 'kv.a': '1', 'kv.b': '2', title: 'T' } } });
      const proxy = draft.currentValues.en;

      delete proxy['kv.a'];
      delete proxy['kv.b'];
      proxy['kv.aa'] = '1';
      proxy['kv.b'] = '2';

      expect(Object.keys(proxy)).toEqual(['title', 'kv.aa', 'kv.b']);
      expect(Object.entries(proxy)).toEqual([
        ['title', 'T'],
        ['kv.aa', '1'],
        ['kv.b', '2'],
      ]);
      expect('kv.a' in proxy).toBe(false);
      expect('kv.b' in proxy).toBe(true);

      // A key that is deleted is gone from the list right away
      delete proxy.title;
      expect(Object.keys(proxy)).toEqual(['kv.aa', 'kv.b']);
    });

    it('should count the writes and deletions as the version', () => {
      const draft = createDraft();
      const proxy = draft.currentValues.en;

      expect(getValueMapVersion(proxy)).toBe(0);
      expect(getValueMapVersion({})).toBeUndefined();
      expect(getValueMapVersion(undefined)).toBeUndefined();

      proxy.title = 'Title';
      expect(getValueMapVersion(proxy)).toBe(1);

      // Writing the same value again is not a change
      proxy.title = 'Title';
      expect(getValueMapVersion(proxy)).toBe(1);

      delete proxy.title;
      expect(getValueMapVersion(proxy)).toBe(2);

      // Deleting a key that is not there is not a change either
      delete proxy.title;
      expect(getValueMapVersion(proxy)).toBe(2);
    });

    it('should duplicate values to other locales when i18n is duplicate', () => {
      getField.mockReturnValue({ widget: 'string', i18n: 'duplicate' });

      const draft = createDraft();

      draft.currentValues.en.title = 'Title';

      expect(draft.currentValues.en.title).toBe('Title');
      expect(draft.currentValues.ja.title).toBe('Title');
    });

    it('should not duplicate values when auto-duplication is suspended', () => {
      getField.mockReturnValue({ widget: 'string', i18n: 'duplicate' });
      isAutoDuplicationEnabled.mockReturnValue(false);

      const draft = createDraft();

      draft.currentValues.en.title = 'Title';

      expect(draft.currentValues.en.title).toBe('Title');
      expect(draft.currentValues.ja.title).toBeUndefined();
    });

    it('should not duplicate values when locale is not default locale', () => {
      getField.mockReturnValue({ widget: 'string', i18n: 'duplicate' });

      const draft = createDraft();

      draft.currentValues.ja.title = 'タイトル';

      expect(draft.currentValues.ja.title).toBe('タイトル');
      expect(draft.currentValues.en.title).toBeUndefined();
    });

    it('should not duplicate values when i18n is not duplicate', () => {
      getField.mockReturnValue({ widget: 'string', i18n: true });

      const draft = createDraft();

      draft.currentValues.en.title = 'Title';

      expect(draft.currentValues.ja.title).toBeUndefined();
    });

    it('should localize a duplicated relation value', () => {
      getField.mockReturnValue({
        widget: 'relation',
        i18n: 'duplicate',
        value_field: '{{locale}}/{{slug}}',
      });

      const draft = createDraft();

      draft.currentValues.en.related = 'en/my-post';

      expect(draft.currentValues.ja.related).toBe('ja/my-post');
    });

    it('should skip revalidation and duplication for the canonical slug field', () => {
      getField.mockReturnValue({ widget: 'string', i18n: 'duplicate' });

      const draft = createDraft();

      draft.currentValues.en.translationKey = 'abc';

      expect(draft.currentValues.en.translationKey).toBe('abc');
      expect(draft.currentValues.ja.translationKey).toBeUndefined();
      expect(revalidateField).not.toHaveBeenCalled();
    });

    it('should use the collection file’s i18n config when available', () => {
      getCollection.mockReturnValue({
        name: 'pages',
        _i18n: { defaultLocale: 'en', canonicalSlug: { key: 'id' } },
      });
      getCollectionFile.mockReturnValue({
        name: 'about',
        _i18n: { defaultLocale: 'fr', canonicalSlug: { key: 'customKey' } },
      });
      getField.mockReturnValue({ widget: 'string', i18n: 'duplicate' });

      const draft = createDraft({ locales: ['fr', 'en'], fileName: 'about' });

      draft.currentValues.fr.customKey = 'should-not-duplicate';
      draft.currentValues.fr.title = 'Titre';

      expect(draft.currentValues.en.customKey).toBeUndefined();
      // `fr` is the default locale of the file
      expect(draft.currentValues.en.title).toBe('Titre');
    });

    it('should revalidate the updated field in real time', () => {
      getField.mockReturnValue({ widget: 'string', i18n: false });

      const draft = createDraft();

      draft.currentValues.en.title = 'Title';
      draft.currentValues.en.count = 42;

      expect(revalidateField).toHaveBeenCalledTimes(2);
      expect(revalidateField).toHaveBeenLastCalledWith({
        draft,
        locale: 'en',
        keyPath: 'count',
        value: 42,
        valueMap: draft.currentValues.en,
      });
    });

    it('should not revalidate when the field is unknown', () => {
      const draft = createDraft();

      draft.currentValues.en.unknown = 'Value';

      expect(draft.currentValues.en.unknown).toBe('Value');
      expect(revalidateField).not.toHaveBeenCalled();
    });

    it('should use getValueMap function when provided', () => {
      const customValueMap = { existingField: 'value' };
      const getValueMap = vi.fn(() => customValueMap);

      getField.mockImplementation(({ valueMap }) =>
        valueMap === customValueMap ? { widget: 'string', i18n: false } : undefined,
      );

      const draft = { collectionName: 'posts', isIndexFile: false, validities: { en: {} } };
      const proxy = createProxy({ draft, locale: 'en', target: {}, getValueMap });

      proxy.title = 'Title';

      expect(getValueMap).toHaveBeenCalled();
      expect(revalidateField).toHaveBeenCalledWith(
        expect.objectContaining({ valueMap: customValueMap }),
      );
    });

    it('should delete properties from other locales when auto-duplication is enabled', () => {
      getField.mockReturnValue({ widget: 'string', i18n: 'duplicate' });

      const draft = createDraft({ values: { en: { title: 'Title' }, ja: { title: 'Title' } } });

      delete draft.currentValues.en.title;

      expect(draft.currentValues.en.title).toBeUndefined();
      expect(draft.currentValues.ja.title).toBeUndefined();
      expect('title' in draft.currentValues.ja).toBe(false);
    });

    it('should not delete from other locales when auto-duplication is suspended', () => {
      getField.mockReturnValue({ widget: 'string', i18n: 'duplicate' });
      isAutoDuplicationEnabled.mockReturnValue(false);

      const draft = createDraft({ values: { en: { title: 'Title' }, ja: { title: 'Title' } } });

      delete draft.currentValues.en.title;

      expect(draft.currentValues.en.title).toBeUndefined();
      expect(draft.currentValues.ja.title).toBe('Title');
    });

    it('should not delete from other locales when the field is not duplicated or unknown', () => {
      getField.mockReturnValue({ widget: 'string', i18n: true });

      const draft = createDraft({
        values: { en: { title: 'Title', other: 'x' }, ja: { title: 'Title', other: 'x' } },
      });

      delete draft.currentValues.en.title;

      expect(draft.currentValues.ja.title).toBe('Title');

      getField.mockReturnValue(undefined);
      delete draft.currentValues.en.other;

      expect(draft.currentValues.en.other).toBeUndefined();
      expect(draft.currentValues.ja.other).toBe('x');
    });
  });
});
