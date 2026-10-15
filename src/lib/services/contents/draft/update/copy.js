import { parse } from 'marked';
import { SvelteSet } from 'svelte/reactivity';

import { createLazyModule } from '$lib/services/api/lazy-module';
import { loadModule } from '$lib/services/app/dependencies';
import { copyFromLocaleToast, translatorApiKeyDialogState } from '$lib/services/contents/editor';
import { getDraftFieldArgs, getField } from '$lib/services/contents/entry/fields';
import { isKeyPathWithin } from '$lib/services/contents/entry/key-paths';
import { RICH_TEXT_FIELD_TYPES, TEXT_FIELD_TYPES } from '$lib/services/contents/fields';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { getValueFormat } from '$lib/services/contents/fields/rich-text';
import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';
import { translator } from '$lib/services/integrations/translators';
import { prefs } from '$lib/services/user/prefs.svelte';
import { escapeHTML } from '$lib/services/utils/string';

/**
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 * @import {
 * EntryDraft,
 * GetFieldArgs,
 * InternalLocaleCode,
 * LocaleContentMap,
 * } from '$lib/types/private';
 * @import { Field, FieldKeyPath, ListField, RichTextField } from '$lib/types/public';
 */

/**
 * @typedef {object} CopyOptions
 * @property {InternalLocaleCode} sourceLanguage Source locale, e.g. `en`.
 * @property {InternalLocaleCode} targetLanguage Target locale, e.g. `ja`.
 * @property {FieldKeyPath} [keyPath] Flattened (dot-notated) object keys that will be used for
 * searching the source values. Omit this if copying all the fields. If the triggered field is the
 * List or Object type, this will likely match multiple fields.
 * @property {boolean} [translate] Whether to translate the copied text fields.
 */

/**
 * @typedef {Record<FieldKeyPath, { value: string, format: 'plain' | 'markdown' | 'html' }>}
 * CopyingFieldMap
 */

/**
 * @typedef {object} PendingTranslation
 * @property {EntryDraft} draft Entry draft being translated into.
 * @property {InternalLocaleCode} targetLanguage Target locale.
 * @property {FieldKeyPath} keyPath Field key path, or an empty string for all the fields.
 */

/**
 * Translations in flight. A request costs money and takes a while, so the same one isn’t sent again
 * until it’s settled, and the UI disables the button that would send it.
 * @type {SvelteSet<PendingTranslation>}
 */
export const pendingTranslations = new SvelteSet();

/**
 * Check if the fields at the given key path are being translated into the given locale.
 * @param {object} args Arguments.
 * @param {EntryDraft | null | undefined} args.draft Entry draft.
 * @param {InternalLocaleCode} args.targetLanguage Target locale.
 * @param {FieldKeyPath} [args.keyPath] Field key path. Omit this for all the fields.
 * @returns {boolean} Result.
 */
export const isTranslationPending = ({ draft, targetLanguage, keyPath = '' }) =>
  [...pendingTranslations].some(
    (translation) =>
      translation.draft === draft &&
      translation.targetLanguage === targetLanguage &&
      translation.keyPath === keyPath,
  );

/**
 * Loader for a Turndown service instance, created on first use. A failed load isn’t remembered, so
 * a later call can try again, e.g. once the network is back.
 */
const turndownLoader = createLazyModule({
  /**
   * Fetch the library from the CDN and create a service instance.
   * @returns {Promise<import('turndown')>} Service instance.
   */
  loader: async () => {
    const { default: TurndownService } = /** @type {{ default: typeof import('turndown') }} */ (
      await loadModule('turndown', 'lib/turndown.browser.es.js')
    );

    const service = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    });

    // @ts-ignore Silence a false type error
    service.keep(['span', 'div']);

    return service;
  },
  notLoadedMessage: 'Turndown is not loaded yet. Call `getTurndownService()` first.',
});

/**
 * Get a Turndown service instance for converting HTML to Markdown. The library is only needed when
 * a translator without Markdown support hands HTML back, so it’s loaded from the CDN on demand
 * rather than shipped in the bundle.
 * @returns {Promise<import('turndown')>} Service instance.
 * @see https://github.com/mixmark-io/turndown
 */
export const getTurndownService = turndownLoader.load;

/**
 * Named HTML character references a translator may return, besides numeric ones.
 * @type {Record<string, string>}
 */
const HTML_ENTITY_MAP = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Decode the HTML character references in text returned by a translator taking HTML, which
 * escapes special characters such as `&` and `"` in its output. Each reference is decoded once,
 * so text escaped with {@link escapeHTML} comes back as it was. An unknown named reference is left
 * as is.
 * @param {string} text Text with character references.
 * @returns {string} Decoded text.
 */
const decodeHTMLEntities = (text) =>
  text.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos));/gi, (ref, dec, hex, name) => {
    if (name) {
      return HTML_ENTITY_MAP[name.toLowerCase()];
    }

    const codePoint = dec ? Number(dec) : Number.parseInt(hex, 16);

    return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ref;
  });

/**
 * Regular expression matching the key path of a list item, capturing the key path of the list.
 */
const LIST_ITEM_KEY_PATH_REGEX = /^(.+)\.\d+$/;

/**
 * Get the `i18n` option that decides whether a field can be copied or translated from another
 * locale. Like the editor (`getFieldLocaleAccess()`), the validator and the default values, it’s
 * the field’s own option, so a subfield without one isn’t written in a locale where the editor
 * hides it, even if the List or Object field it belongs to is translatable. An item of a List field
 * without subfields has no configuration of its own, so it takes the option of the List field,
 * which the editor shows as a whole.
 * @param {object} args Arguments.
 * @param {Field | undefined} args.field Field configuration, if the key path has one.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the key
 * path of the field.
 * @returns {Field['i18n']} Option.
 */
const getCopyI18nOption = ({ field, getFieldArgs }) => {
  if (field) {
    return field.i18n;
  }

  const [, listKeyPath] = getFieldArgs.keyPath.match(LIST_ITEM_KEY_PATH_REGEX) ?? [];
  const listField = listKeyPath ? getField({ ...getFieldArgs, keyPath: listKeyPath }) : undefined;

  return listField?.widget === 'list' &&
    !getListFieldInfo(/** @type {ListField} */ (listField)).hasSubFields
    ? listField.i18n
    : undefined;
};

/**
 * Get a list of fields to be copied or translated from the source locale to the target locale.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {CopyOptions} args.options Copy options.
 * @returns {CopyingFieldMap} Copied or translated field values.
 */
export const getCopyingFieldMap = ({ draft, options }) => {
  const { currentValues } = draft;
  const { sourceLanguage, targetLanguage, keyPath = '', translate = false } = options;
  const valueMap = currentValues[sourceLanguage];
  const getFieldArgs = getDraftFieldArgs(draft, { valueMap });

  return Object.fromEntries(
    Object.entries(valueMap)
      .map(([_keyPath, value]) => {
        const targetLocaleValue = currentValues[targetLanguage][_keyPath];
        const field = getField({ ...getFieldArgs, keyPath: _keyPath });
        const fieldType = field?.widget ?? 'string';

        if (
          (keyPath && !isKeyPathWithin(_keyPath, keyPath)) ||
          // Only a translatable field has a value of its own in each locale: a field that isn’t
          // localized is only saved in the default locale, and a duplicated one can’t be edited
          // in the other locales
          !isFieldTranslatable(
            getCopyI18nOption({ field, getFieldArgs: { ...getFieldArgs, keyPath: _keyPath } }),
          ) ||
          typeof value !== 'string' ||
          !value ||
          ![...TEXT_FIELD_TYPES, 'list'].includes(fieldType) ||
          // prettier-ignore
          (fieldType === 'list' &&
          getListFieldInfo(/** @type {ListField} */ (field)).hasSubFields) ||
          (!translate && value === targetLocaleValue) ||
          // Skip populated fields when translating all the fields
          (!keyPath && translate && !!targetLocaleValue)
        ) {
          return null;
        }

        const format = RICH_TEXT_FIELD_TYPES.includes(fieldType)
          ? getValueFormat(/** @type {RichTextField} */ (field))
          : 'plain';

        return [_keyPath, { value, format }];
      })
      .filter((entry) => !!entry),
  );
};

/**
 * Update the toast notification.
 * @param {'info' | 'success' | 'error'} status Status.
 * @param {string} message Message key.
 * @param {object} context Context.
 * @param {number} context.count Number of fields copied or translated.
 * @param {InternalLocaleCode} context.sourceLanguage Source locale, e.g. `en`.
 */
export const updateToast = (status, message, { count, sourceLanguage }) => {
  copyFromLocaleToast.current = {
    id: Date.now(),
    show: true,
    status,
    message,
    count,
    sourceLanguage,
  };
};

/**
 * Translate the field value(s) from another locale.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.currentValues Current values for the entry draft. This will be
 * updated with the translated values.
 * @param {CopyOptions} args.options Copy options.
 * @param {CopyingFieldMap} args.copingFieldMap Copied or translated field values.
 * @param {() => boolean} [args.isDraftClosed] Function telling whether the draft has been closed
 * since the request was made, in which case the results are dropped.
 */
export const translateFields = async ({
  currentValues,
  options,
  copingFieldMap,
  isDraftClosed = () => false,
}) => {
  const { serviceId } = translator.current;
  const { sourceLanguage, targetLanguage, keyPath } = options;
  const count = Object.keys(copingFieldMap).length;

  // The target values as they were when the fields to translate were picked, so that a field the
  // user fills in while the request is in flight isn’t overwritten when translating all the fields
  const targetValues = Object.fromEntries(
    Object.keys(copingFieldMap).map((_keyPath) => [
      _keyPath,
      currentValues[targetLanguage][_keyPath],
    ]),
  );

  let apiKey = prefs.apiKeys?.[serviceId];

  if (!apiKey) {
    const { promise, resolve } = Promise.withResolvers();

    translatorApiKeyDialogState.current = { show: true, multiple: count > 1, resolve };

    // The promise will be resolved once the user enters an API key on the dialog
    apiKey = await promise;
  }

  if (!apiKey) {
    return;
  }

  // Get the translator service again in case the user has selected a different service in the API
  // key dialog, which will update the `translator` store
  const { markdownSupported, translate } = translator.current;

  updateToast('info', 'translation.started', { count, sourceLanguage });

  try {
    // A translator without Markdown support takes HTML, e.g. Google Translate with the `html`
    // format and DeepL with HTML tag handling. A Markdown value is converted to HTML for it, a
    // plain text value is escaped, so that its special characters are read as text, and an HTML
    // value is passed as is
    const translatedValues = await translate(
      Object.entries(copingFieldMap).map(([, { value, format }]) =>
        markdownSupported || format === 'html'
          ? value
          : format === 'markdown'
            ? /** @type {string} */ (parse(value))
            : escapeHTML(value),
      ),
      { apiKey, sourceLanguage, targetLanguage },
    );

    const needsTurndown =
      !markdownSupported &&
      Object.values(copingFieldMap).some(({ format }) => format === 'markdown');

    const turndownService = needsTurndown ? await getTurndownService() : undefined;

    // The user has opened another entry in the meantime
    if (isDraftClosed()) {
      return;
    }

    let translatedCount = 0;

    Object.entries(copingFieldMap).forEach(([_keyPath, { format }], index) => {
      const value = translatedValues[index];

      if (!keyPath && currentValues[targetLanguage][_keyPath] !== targetValues[_keyPath]) {
        return;
      }

      translatedCount += 1;

      // Convert the value back to Markdown or plain text if needed. The HTML comes back with its
      // special characters as entities, which Turndown decodes for a Markdown value
      currentValues[targetLanguage][_keyPath] =
        markdownSupported || format === 'html'
          ? value
          : format === 'markdown'
            ? // @ts-ignore Silence a false type error
              /** @type {import('turndown')} */ (turndownService).turndown(value)
            : decodeHTMLEntities(value);
    });

    updateToast('success', 'translation.complete', { count: translatedCount, sourceLanguage });
  } catch (ex) {
    if (!isDraftClosed()) {
      // @todo Show a detailed error message.
      updateToast('error', 'translation.error', { count, sourceLanguage });
    }

    // eslint-disable-next-line no-console
    console.error(ex);
  }
};

/**
 * Copy the field value(s) from another locale.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.currentValues Current values for the entry draft. This will be
 * updated with the copied values.
 * @param {CopyOptions} args.options Copy options.
 * @param {CopyingFieldMap} args.copingFieldMap Copied or translated field values.
 */
export const copyFields = ({ currentValues, options, copingFieldMap }) => {
  const { sourceLanguage, targetLanguage } = options;
  const count = Object.keys(copingFieldMap).length;

  Object.entries(copingFieldMap).forEach(([_keyPath, { value }]) => {
    currentValues[targetLanguage][_keyPath] = value;
  });

  updateToast('success', 'copy.complete', { count, sourceLanguage });
};

/**
 * Copy or translate field value(s) from another locale. A translation already in flight for the
 * same fields and locale isn’t requested again.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {CopyOptions} args.options Copy options.
 * @param {EntryDraftState} [args.entryDraft] Entry draft state of the editor. If given, the results
 * of a translation are dropped once the draft is no longer the one in the editor.
 */
export const copyFromLocale = async ({ draft, options, entryDraft }) => {
  const { sourceLanguage, targetLanguage, keyPath = '', translate = false } = options;

  if (translate && isTranslationPending({ draft, targetLanguage, keyPath })) {
    return;
  }

  const { currentValues } = draft;
  const copingFieldMap = getCopyingFieldMap({ draft, options });
  const count = Object.keys(copingFieldMap).length;

  if (!count) {
    updateToast('info', `${translate ? 'translation' : 'copy'}.none`, { count, sourceLanguage });

    return;
  }

  if (translate) {
    /** @type {PendingTranslation} */
    const pendingTranslation = { draft, targetLanguage, keyPath };
    /**
     * Check whether the draft is no longer the one in the editor.
     * @returns {boolean} Result.
     */
    const isDraftClosed = () => !!entryDraft && entryDraft.current !== draft;

    pendingTranslations.add(pendingTranslation);

    try {
      await translateFields({ currentValues, options, copingFieldMap, isDraftClosed });
    } finally {
      pendingTranslations.delete(pendingTranslation);
    }
  } else {
    copyFields({ currentValues, options, copingFieldMap });
  }
};
