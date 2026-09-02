import { get } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';
import {
  getIndexFile,
  isCollectionIndexFile,
} from '$lib/services/contents/collection/entries/index-file';
import { entryDraft, revokeDraftFileURLs } from '$lib/services/contents/draft';
import { restoreBackupIfNeeded } from '$lib/services/contents/draft/backup';
import { normalizeContentMap } from '$lib/services/contents/draft/create/normalize';
import { createProxy } from '$lib/services/contents/draft/create/proxy';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { resetCustomFieldValidation } from '$lib/services/contents/draft/validate/custom-fields';
import { isPendingDeletion } from '$lib/services/workflow';

/**
 * @import {
 * EntryDraft,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalEntryCollection,
 * LocaleContentMap,
 * LocaleExpanderMap,
 * LocaleSlugMap,
 * } from '$lib/types/private';
 */

/**
 * Tag to enable the slug editor for the default locale.
 * @internal
 */
export const SLUG_EDITOR_TAG = '{{fields._slug}}';

/**
 * Tag to enable the slug editor for all locales.
 * @internal
 */
export const LOCALIZED_SLUG_EDITOR_TAG = '{{fields._slug | localize}}';

/**
 * Get the `slugEditor` property for an entry draft.
 * @internal
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection that the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {LocaleSlugMap} args.originalSlugs Original slugs for each locale.
 * @returns {Record<string, boolean | 'readonly'>} Whether to show the slug editor for each locale.
 * If the `slug` template contains the `{{fields._slug}}` tag, the slug editor will be enabled for
 * the default locale and disabled (read-only) for other locales. If the `slug` template contains
 * the `{{fields._slug | localize}}` tag, the slug editor will be enabled for all locales.
 * Otherwise, the slug editor will be disabled for all locales. Note that the slug editor will only
 * be shown for new entries in entry collections.
 * @see https://github.com/sveltia/sveltia-cms/issues/499
 */
export const getSlugEditorProp = ({ collection, collectionFile, originalSlugs }) => {
  const isEntryCollection = collection._type === 'entry';
  const { allLocales, defaultLocale } = (collectionFile ?? collection)._i18n;

  // The slug editor is only relevant for entry collections
  if (!isEntryCollection) {
    return Object.fromEntries(allLocales.map((locale) => [locale, false]));
  }

  const {
    identifier_field: identifierField = 'title',
    slug: slugTemplate = `{{${identifierField}}}`,
  } = collection;

  const localizedSlugEditorEnabled = slugTemplate.includes(LOCALIZED_SLUG_EDITOR_TAG);
  const slugEditorEnabled = slugTemplate.includes(SLUG_EDITOR_TAG) || localizedSlugEditorEnabled;

  return Object.fromEntries(
    allLocales.map((locale) => {
      if (!slugEditorEnabled || originalSlugs._ || originalSlugs[locale]) {
        return [locale, false];
      }

      return [locale, locale === defaultLocale || localizedSlugEditorEnabled || 'readonly'];
    }),
  );
};

/**
 * Build an entry draft object. This only assembles the values; it’s {@link createDraft} that opens
 * the draft in the editor. A draft can also be built on its own to check an entry that isn’t being
 * edited, in which case the application state is left untouched.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection that the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {any} [args.originalEntry] Entry to be edited, or a partial {@link Entry} object.
 * @param {Record<string, string>} [args.dynamicValues] Dynamic default values for a new entry
 * passed through URL parameters.
 * @param {LocaleContentMap} [args.extraValues] Key is a locale code, value is a flattened object
 * containing field values in rich text editor components. Can be set when resetting an entry draft.
 * @param {LocaleExpanderMap} [args.expanderStates] Expander UI state. Can be set when resetting an
 * entry draft.
 * @param {boolean} [args.isIndexFile] Whether to edit the collection’s index file.
 * @returns {EntryDraft} Entry draft.
 */
export const buildDraft = ({
  collection,
  collectionFile,
  originalEntry = {},
  dynamicValues,
  extraValues,
  expanderStates,
  isIndexFile = isCollectionIndexFile(collection, originalEntry),
}) => {
  const collectionName = collection.name;
  const fileName = collectionFile?.name;
  const { id, locales } = originalEntry;
  const isNew = id === undefined;

  const { fields: regularFields = [], _i18n } =
    collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const indexFile = isIndexFile ? getIndexFile(collection) : undefined;
  const fields = indexFile?.fields ?? regularFields;

  const canPreview =
    indexFile?.editor?.preview ??
    collectionFile?.editor?.preview ??
    collection.editor?.preview ??
    get(cmsConfig)?.editor?.preview ??
    true;

  const {
    allLocales,
    initialLocales,
    defaultLocale,
    // `canonicalSlug.key` is always set by config normalization (defaults to 'translationKey')
    canonicalSlug: { key: canonicalSlugKey },
  } = _i18n;

  const enabledLocales = isNew
    ? initialLocales
    : allLocales.filter((locale) => !!locales?.[locale]?.content);

  const originalLocales = Object.fromEntries(
    allLocales.map((locale) => [locale, enabledLocales.includes(locale)]),
  );

  const originalSlugs = isNew
    ? {}
    : canonicalSlugKey in (locales?.[defaultLocale]?.content ?? {})
      ? Object.fromEntries(allLocales.map((locale) => [locale, locales?.[locale]?.slug]))
      : { _: locales?.[defaultLocale].slug };

  /** @type {LocaleContentMap} */
  const originalValues = Object.fromEntries(
    enabledLocales.map((locale) =>
      isNew
        ? [locale, getDefaultValues({ fields, locale, defaultLocale, dynamicValues })]
        : [locale, structuredClone(locales?.[locale]?.content)],
    ),
  );

  if (!isNew) {
    // Existing entries can predate the current field configuration: a field added since, or an
    // optional field left empty and later made required, is simply absent from the file. Fill those
    // in so the editor shows their default values and the validator sees them
    normalizeContentMap({ fields, contentMap: originalValues, defaultLocale });
  }

  return {
    id: isNew ? crypto.randomUUID() : id,
    createdAt: Date.now(),
    isNew,
    isIndexFile,
    canPreview,
    collectionName,
    collection,
    fileName,
    collectionFile,
    fields,
    originalEntry: isNew ? undefined : originalEntry,
    defaultLocale,
    originalLocales,
    currentLocales: structuredClone(originalLocales),
    originalSlugs,
    currentSlugs: structuredClone(originalSlugs),
    originalValues,
    currentValues: Object.fromEntries(
      enabledLocales.map((locale) => [
        locale,
        createProxy({
          draft: { collectionName, fileName, isIndexFile },
          locale,
          target: structuredClone(originalValues[locale]),
        }),
      ]),
    ),
    files: {},
    extraValues: extraValues ?? Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    validities: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    validationMessages: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    // Any locale-agnostic view states will be put under the `_` key
    expanderStates: expanderStates ?? { _: {} },
    slugEditor: getSlugEditorProp({ collection, collectionFile, originalSlugs }),
  };
};

/**
 * Create an entry draft and open it in the editor.
 * @param {object} args Arguments. See {@link buildDraft}.
 * @param {InternalCollection} args.collection Collection that the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {any} [args.originalEntry] Entry to be edited, or a partial {@link Entry} object.
 * @param {Record<string, string>} [args.dynamicValues] Dynamic default values for a new entry
 * passed through URL parameters.
 * @param {LocaleContentMap} [args.extraValues] Key is a locale code, value is a flattened object
 * containing field values in rich text editor components. Can be set when resetting an entry draft.
 * @param {LocaleExpanderMap} [args.expanderStates] Expander UI state. Can be set when resetting an
 * entry draft.
 * @param {boolean} [args.isIndexFile] Whether to edit the collection’s index file.
 */
export const createDraft = (args) => {
  const { collection, collectionFile, originalEntry = {} } = args;
  const collectionName = collection.name;
  const fileName = collectionFile?.name;
  const { slug } = originalEntry;

  // Custom field validation state is keyed by locale and key path only, so discard it to prevent
  // verdicts from a previous draft leaking into this one
  resetCustomFieldValidation();
  // The outgoing draft’s unsaved files are about to become unreachable; release what they hold
  revokeDraftFileURLs();

  entryDraft.set(buildDraft(args));

  // An entry awaiting deletion is read-only, so a cached draft would be neither restorable nor
  // useful
  if (!isPendingDeletion(originalEntry)) {
    restoreBackupIfNeeded({ collectionName, fileName, slug });
  }
};
