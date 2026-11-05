import { isObject } from '@sveltia/utils/object';

import { replaceTemplatePlaceholder } from '$lib/services/common/template/replacers';
import { hasTemplateTags, replaceTemplateTags } from '$lib/services/common/template/tags';
import { getIdentifierFieldName } from '$lib/services/contents/collection/identifier';
import { getFillSlugOptions } from '$lib/services/contents/draft/slugs';
import { findLibraryOptions } from '$lib/services/integrations/media-libraries/options';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { ReplaceContext } from '$lib/services/common/template/replacers';
 * @import { MediaField, MediaLibraries } from '$lib/types/public';
 */

/**
 * Result of {@link fillLibraryPrefix}.
 * @typedef {object} FilledLibraryPrefix
 * @property {MediaField} [fieldConfig] Field configuration to use the service with, with the
 * `prefix` option filled.
 * @property {boolean} unresolved Whether the prefix depends on a value the entry doesn’t have yet,
 * so the service can’t be used: its files would end up outside the folder they belong to.
 */

/**
 * Fill the template tags in a prefix with the values of an entry draft.
 * @param {string} prefix The `prefix` option.
 * @param {EntryDraft} draft Entry draft.
 * @param {InternalLocaleCode} [locale] Locale the file is selected for. A field that’s not
 * translated only has a value in the default locale.
 * @returns {string} Filled prefix.
 * @throws {Error} If a tag has no value.
 */
const fillPrefixTemplate = (prefix, draft, locale) => {
  const { collection, fileName, currentValues, isIndexFile, originalEntry } = draft;
  const options = getFillSlugOptions({ draft });
  const content = { ...options.content, ...(locale ? currentValues[locale] : undefined) };

  const identifierField = getIdentifierFieldName(
    collection._type === 'entry' ? collection : undefined,
  );

  /** @type {ReplaceContext} */
  const context = {
    replaceSubContext: {
      ...options,
      type: 'library_prefix',
      content,
      currentSlug: options.content._slug ?? originalEntry?.slug,
      locale: locale ?? options.locale,
      identifierField,
      basePath: undefined,
    },
    getFieldArgs: {
      collectionName: collection.name,
      fileName,
      keyPath: '',
      valueMap: content,
      isIndexFile,
    },
  };

  return replaceTemplateTags(prefix, (_match, tag) =>
    replaceTemplatePlaceholder(tag, context),
  ).trim();
};

/**
 * Fill the template tags in the field-level `prefix` option of a cloud storage service, so that the
 * files of an entry can go to a folder named after one of its fields, e.g. `{{fields.release}}/`.
 * The options are set on a copy of the field configuration, which takes precedence over the
 * site-level ones when the service resolves them.
 * @param {object} args Arguments.
 * @param {keyof MediaLibraries} args.serviceId Service ID.
 * @param {MediaField} [args.fieldConfig] Field configuration.
 * @param {EntryDraft | null} [args.draft] Entry draft.
 * @param {InternalLocaleCode} [args.locale] Locale the file is selected for.
 * @returns {FilledLibraryPrefix} Field configuration to use, and whether the prefix is unresolved.
 */
export const fillLibraryPrefix = ({ serviceId, fieldConfig, draft, locale }) => {
  const options = /** @type {Record<string, any> | false | undefined} */ (
    findLibraryOptions(serviceId, fieldConfig)
  );

  const prefix = isObject(options) ? /** @type {any} */ (options).prefix : undefined;

  if (typeof prefix !== 'string' || !hasTemplateTags(prefix)) {
    return { fieldConfig, unresolved: false };
  }

  if (!draft) {
    return { fieldConfig, unresolved: true };
  }

  try {
    return {
      fieldConfig: /** @type {MediaField} */ ({
        ...fieldConfig,
        media_libraries: {
          .../** @type {MediaField} */ (fieldConfig).media_libraries,
          [serviceId]: { ...options, prefix: fillPrefixTemplate(prefix, draft, locale) },
        },
      }),
      unresolved: false,
    };
  } catch {
    return { fieldConfig, unresolved: true };
  }
};
