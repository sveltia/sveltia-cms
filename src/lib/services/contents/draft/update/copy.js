import { parse } from 'marked';
import { get } from 'svelte/store';
import TurndownService from 'turndown';

import { entryDraft } from '$lib/services/contents/draft';
import { copyFromLocaleToast, translatorApiKeyDialogState } from '$lib/services/contents/editor';
import { getField } from '$lib/services/contents/entry/fields';
import { translator } from '$lib/services/integrations/translators';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Writable } from 'svelte/store';
 * @import { EntryDraft, InternalLocaleCode, LocaleContentMap } from '$lib/types/private';
 * @import { FieldKeyPath, ListField } from '$lib/types/public';
 */

/**
 * @typedef {object} CopyOptions
 * @property {InternalLocaleCode} sourceLanguage Source locale, e.g. `en`.
 * @property {InternalLocaleCode} targetLanguage Target locale, e.g. `ja`.
 * @property {FieldKeyPath} [keyPath] Flattened (dot-notated) object keys that will be used for
 * searching the source values. Omit this if copying all the fields. If the triggered widget is List
 * or Object, this will likely match multiple fields.
 * @property {boolean} [translate] Whether to translate the copied text fields.
 */

/**
 * @typedef {Record<FieldKeyPath, { value: string, isMarkdown: boolean }>} CopyingFieldMap
 */

/**
 * Initialize a Turndown service instance for converting HTML to Markdown.
 * @internal
 * @see https://github.com/mixmark-io/turndown
 */
export const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

// @ts-ignore Silence a false type error
turndownService.keep(['span', 'div']);

/**
 * Get a list of fields to be copied or translated from the source locale to the target locale.
 * @internal
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {CopyOptions} args.options Copy options.
 * @returns {CopyingFieldMap} Copied or translated field values.
 */
export const getCopyingFieldMap = ({ draft, options }) => {
  const { collectionName, fileName, currentValues, isIndexFile } = draft;
  const { sourceLanguage, targetLanguage, keyPath = '', translate = false } = options;
  const valueMap = currentValues[sourceLanguage];
  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };

  return Object.fromEntries(
    Object.entries(valueMap)
      .map(([_keyPath, value]) => {
        const targetLocaleValue = currentValues[targetLanguage][_keyPath];
        const field = getField({ ...getFieldArgs, keyPath: _keyPath });
        const widget = field?.widget ?? 'string';

        if (
          (keyPath && !_keyPath.startsWith(keyPath)) ||
          typeof value !== 'string' ||
          !value ||
          !['markdown', 'text', 'string', 'list'].includes(widget) ||
          // prettier-ignore
          (widget === 'list' &&
          (/** @type {ListField} */ (field).field ?? /** @type {ListField} */ (field).fields)) ||
          (!translate && value === targetLocaleValue) ||
          // Skip populated fields when translating all the fields
          (!keyPath && translate && !!targetLocaleValue)
        ) {
          return null;
        }

        return [_keyPath, { value, isMarkdown: widget === 'markdown' }];
      })
      .filter((entry) => !!entry),
  );
};

/**
 * Update the toast notification.
 * @internal
 * @param {'info' | 'success' | 'error'} status Status.
 * @param {string} message Message key.
 * @param {object} context Context.
 * @param {number} context.count Number of fields copied or translated.
 * @param {InternalLocaleCode} context.sourceLanguage Source locale, e.g. `en`.
 */
export const updateToast = (status, message, { count, sourceLanguage }) => {
  copyFromLocaleToast.set({ id: Date.now(), show: true, status, message, count, sourceLanguage });
};

/**
 * Translate the field value(s) from another locale.
 * @internal
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.currentValues Current values for the entry draft. This will be
 * updated with the translated values.
 * @param {CopyOptions} args.options Copy options.
 * @param {CopyingFieldMap} args.copingFieldMap Copied or translated field values.
 */
export const translateFields = async ({ currentValues, options, copingFieldMap }) => {
  const { serviceId, markdownSupported, translate } = get(translator);
  const { sourceLanguage, targetLanguage } = options;
  const count = Object.keys(copingFieldMap).length;
  const countType = count === 1 ? 'one' : 'many';

  const apiKey =
    get(prefs).apiKeys?.[serviceId] ||
    (await new Promise((resolve) => {
      // The promise will be resolved once the user enters an API key on the dialog
      translatorApiKeyDialogState.set({ show: true, multiple: count > 1, resolve });
    }));

  if (!apiKey) {
    return;
  }

  updateToast('info', 'translation.started', { count, sourceLanguage });

  try {
    const translatedValues = await translate(
      Object.entries(copingFieldMap).map(([, { value, isMarkdown }]) =>
        // Convert the value from Markdown to HTML if needed
        isMarkdown && !markdownSupported ? /** @type {string} */ (parse(value)) : value,
      ),
      { apiKey, sourceLanguage, targetLanguage },
    );

    Object.entries(copingFieldMap).forEach(([_keyPath, { isMarkdown }], index) => {
      const value = translatedValues[index];

      // Convert the value back to Markdown if needed
      currentValues[targetLanguage][_keyPath] =
        // @ts-ignore Silence a false type error
        isMarkdown && !markdownSupported ? turndownService.turndown(value) : value;
    });

    updateToast('success', `translation.complete.${countType}`, { count, sourceLanguage });
  } catch (ex) {
    // @todo Show a detailed error message.
    updateToast('error', 'translation.error', { count, sourceLanguage });
    // eslint-disable-next-line no-console
    console.error(ex);
  }
};

/**
 * Copy the field value(s) from another locale.
 * @internal
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.currentValues Current values for the entry draft. This will be
 * updated with the copied values.
 * @param {CopyOptions} args.options Copy options.
 * @param {CopyingFieldMap} args.copingFieldMap Copied or translated field values.
 */
export const copyFields = ({ currentValues, options, copingFieldMap }) => {
  const { sourceLanguage, targetLanguage } = options;
  const count = Object.keys(copingFieldMap).length;
  const countType = count === 1 ? 'one' : 'many';

  Object.entries(copingFieldMap).forEach(([_keyPath, { value }]) => {
    currentValues[targetLanguage][_keyPath] = value;
  });

  updateToast('success', `copy.complete.${countType}`, { count, sourceLanguage });
};

/**
 * Copy or translate field value(s) from another locale.
 * @param {CopyOptions} options Copy options.
 */
export const copyFromLocale = async (options) => {
  const { sourceLanguage, translate = false } = options;
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { currentValues } = draft;
  const copingFieldMap = getCopyingFieldMap({ draft, options });
  const count = Object.keys(copingFieldMap).length;

  if (!count) {
    updateToast('info', `${translate ? 'translation' : 'copy'}.none`, { count, sourceLanguage });

    return;
  }

  if (translate) {
    await translateFields({ currentValues, options, copingFieldMap });
  } else {
    copyFields({ currentValues, options, copingFieldMap });
  }

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    currentValues,
  }));
};
