import { describe, expect, test, vi } from 'vitest';

import { isDuplicatedField } from '$lib/services/contents/draft/create/proxy.svelte';
import { getFieldLocaleAccess } from '$lib/services/contents/editor/locale';

/**
 * @import { EntryDraft } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/draft/create/proxy.svelte', () => ({
  isDuplicatedField: vi.fn(({ fieldConfig }) => fieldConfig.i18n === 'duplicate'),
}));

const draft = /** @type {EntryDraft} */ (
  /** @type {unknown} */ ({
    collectionName: 'posts',
    fileName: undefined,
    isIndexFile: false,
    collection: { _i18n: { i18nEnabled: true, defaultLocale: 'en' } },
  })
);

const valueMap = { title: 'Hello' };

/**
 * Get the access to a field in a locale.
 * @param {Field['i18n'] | 'duplicate_keys'} i18n Field-level `i18n` option.
 * @param {string} locale Locale.
 * @param {object} [options] Options.
 * @param {EntryDraft} [options.entryDraft] Entry draft.
 * @param {boolean} [options.inEditorComponent] Whether the field is in an editor component.
 * @returns {ReturnType<typeof getFieldLocaleAccess>} Result.
 */
const getAccess = (i18n, locale, { entryDraft = draft, inEditorComponent } = {}) =>
  getFieldLocaleAccess({
    draft: entryDraft,
    fieldConfig: /** @type {Field} */ ({ name: 'title', widget: 'string', i18n }),
    keyPath: 'title',
    locale,
    valueMap,
    inEditorComponent,
  });

describe('getFieldLocaleAccess()', () => {
  test('shows any field in the default locale', () => {
    expect(getAccess(false, 'en')).toEqual({
      canTranslate: false,
      isDuplicated: false,
      areKeysDuplicated: false,
      isShown: true,
    });
    expect(getAccess('duplicate', 'en')).toEqual({
      canTranslate: false,
      isDuplicated: false,
      areKeysDuplicated: false,
      isShown: true,
    });
    expect(getAccess(true, 'en').canTranslate).toBe(true);
    // The ancestors aren’t looked up for the default locale
    expect(isDuplicatedField).not.toHaveBeenCalled();
  });

  test('shows a translatable field in another locale', () => {
    expect(getAccess(true, 'ja')).toEqual({
      canTranslate: true,
      isDuplicated: false,
      areKeysDuplicated: false,
      isShown: true,
    });
    expect(getAccess('translate', 'ja').canTranslate).toBe(true);
  });

  test('hides a field without i18n in another locale', () => {
    expect(getAccess(false, 'ja')).toEqual({
      canTranslate: false,
      isDuplicated: false,
      areKeysDuplicated: false,
      isShown: false,
    });
  });

  test('shows a duplicated field in another locale', () => {
    expect(getAccess('duplicate', 'ja')).toEqual({
      canTranslate: false,
      isDuplicated: true,
      areKeysDuplicated: false,
      isShown: true,
    });
    expect(isDuplicatedField).toHaveBeenCalledWith({
      fieldConfig: { name: 'title', widget: 'string', i18n: 'duplicate' },
      getFieldArgs: {
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        keyPath: 'title',
        valueMap,
      },
    });
  });

  test('shows a KeyValue field whose keys are duplicated in another locale', () => {
    expect(getAccess('duplicate_keys', 'ja')).toEqual({
      canTranslate: false,
      isDuplicated: false,
      areKeysDuplicated: true,
      isShown: true,
    });
  });

  test('only takes the own option of a rich text editor component’s subfield', () => {
    expect(getAccess('duplicate', 'ja', { inEditorComponent: true })).toEqual({
      canTranslate: false,
      isDuplicated: true,
      areKeysDuplicated: false,
      isShown: true,
    });
    expect(getAccess(undefined, 'ja', { inEditorComponent: true })).toEqual({
      canTranslate: false,
      isDuplicated: false,
      areKeysDuplicated: false,
      isShown: true,
    });
    expect(isDuplicatedField).not.toHaveBeenCalled();
  });

  test('uses the collection file’s i18n options', () => {
    const entryDraft = /** @type {EntryDraft} */ ({
      ...draft,
      collectionFile: { _i18n: { i18nEnabled: false, defaultLocale: '_default' } },
    });

    expect(getAccess(true, 'ja', { entryDraft })).toEqual({
      canTranslate: false,
      isDuplicated: false,
      areKeysDuplicated: false,
      isShown: false,
    });
  });

  test('falls back to the default i18n options without a draft', () => {
    expect(getAccess('duplicate', '_default', { entryDraft: /** @type {any} */ (null) })).toEqual({
      canTranslate: false,
      isDuplicated: false,
      areKeysDuplicated: false,
      isShown: true,
    });
  });
});
