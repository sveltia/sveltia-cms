import { parse } from 'marked';

import { loadModule } from '$lib/services/app/dependencies';
import { copyFromLocaleToast, translatorApiKeyDialogState } from '$lib/services/contents/editor';
import { getField } from '$lib/services/contents/entry/fields';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { translator } from '$lib/services/integrations/translators';
import { prefs } from '$lib/services/user/prefs.svelte';

/**
 * @import { EntryDraft, InternalLocaleCode, LocaleContentMap } from '$lib/types/private';
 * @import { FieldKeyPath, ListField } from '$lib/types/public';
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
 * @typedef {Record<FieldKeyPath, { value: string, isMarkdown: boolean }>} CopyingFieldMap
 */

/**
 * Turndown service instance, created on first use.
 * @type {Promise<import('turndown')> | undefined}
 */
let turndownServicePromise;

/**
 * Get a Turndown service instance for converting HTML to Markdown. The library is only needed when
 * a translator without Markdown support hands HTML back, so it’s loaded from the CDN on demand
 * rather than shipped in the bundle.
 * @returns {Promise<import('turndown')>} Service instance.
 * @see https://github.com/mixmark-io/turndown
 */
export const getTurndownService = async () => {
  turndownServicePromise ??= (async () => {
    /** @type {{ default: typeof import('turndown') }} */
    let module;

    try {
      module = await loadModule('turndown', 'lib/turndown.browser.es.js');
    } catch (error) {
      // Let a later call try again, e.g. once the network is back
      turndownServicePromise = undefined;
      throw error;
    }

    const { default: TurndownService } = module;

    const service = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    });

    // @ts-ignore Silence a false type error
    service.keep(['span', 'div']);

    return service;
  })();

  return turndownServicePromise;
};

/**
 * Get a list of fields to be copied or translated from the source locale to the target locale.
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
        const fieldType = field?.widget ?? 'string';

        if (
          (keyPath && !_keyPath.startsWith(keyPath)) ||
          typeof value !== 'string' ||
          !value ||
          !['richtext', 'markdown', 'text', 'string', 'list'].includes(fieldType) ||
          // prettier-ignore
          (fieldType === 'list' &&
          getListFieldInfo(/** @type {ListField} */ (field)).hasSubFields) ||
          (!translate && value === targetLocaleValue) ||
          // Skip populated fields when translating all the fields
          (!keyPath && translate && !!targetLocaleValue)
        ) {
          return null;
        }

        const isMarkdown = fieldType === 'richtext' || fieldType === 'markdown';

        return [_keyPath, { value, isMarkdown }];
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
 */
export const translateFields = async ({ currentValues, options, copingFieldMap }) => {
  const { serviceId } = translator.current;
  const { sourceLanguage, targetLanguage } = options;
  const count = Object.keys(copingFieldMap).length;
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
    const translatedValues = await translate(
      Object.entries(copingFieldMap).map(([, { value, isMarkdown }]) =>
        // Convert the value from Markdown to HTML if needed
        isMarkdown && !markdownSupported ? /** @type {string} */ (parse(value)) : value,
      ),
      { apiKey, sourceLanguage, targetLanguage },
    );

    const needsTurndown =
      !markdownSupported && Object.values(copingFieldMap).some(({ isMarkdown }) => isMarkdown);

    const turndownService = needsTurndown ? await getTurndownService() : undefined;

    Object.entries(copingFieldMap).forEach(([_keyPath, { isMarkdown }], index) => {
      const value = translatedValues[index];

      // Convert the value back to Markdown if needed
      currentValues[targetLanguage][_keyPath] =
        // @ts-ignore Silence a false type error
        isMarkdown && turndownService ? turndownService.turndown(value) : value;
    });

    updateToast('success', 'translation.complete', { count, sourceLanguage });
  } catch (ex) {
    // @todo Show a detailed error message.
    updateToast('error', 'translation.error', { count, sourceLanguage });
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
 * Copy or translate field value(s) from another locale.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {CopyOptions} args.options Copy options.
 */
export const copyFromLocale = async ({ draft, options }) => {
  const { sourceLanguage, translate = false } = options;
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
};
