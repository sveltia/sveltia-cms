import { stripSlashes } from '@sveltia/utils/string';

import { cmsConfig } from '$lib/services/config';
import {
  getIndexFile,
  isCollectionIndexFile,
} from '$lib/services/contents/collection/entries/index-file';
import {
  getEntryDirPath,
  getMetaPathConfig,
  nestedFilterPath,
} from '$lib/services/contents/collection/nested';
import { revokeDraftFileURLs } from '$lib/services/contents/draft';
import { restoreBackupIfNeeded } from '$lib/services/contents/draft/backup';
import { normalizeContentMap } from '$lib/services/contents/draft/create/normalize';
import { createProxy } from '$lib/services/contents/draft/create/proxy.svelte';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { resetCustomFieldValidation } from '$lib/services/contents/draft/validate/custom-fields';
import { createState } from '$lib/services/utils/state.svelte';
import { isPendingDeletion } from '$lib/services/workflow';

/**
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
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
 */
export const SLUG_EDITOR_TAG = '{{fields._slug}}';

/**
 * Tag to enable the slug editor for all locales.
 */
export const LOCALIZED_SLUG_EDITOR_TAG = '{{fields._slug | localize}}';

/**
 * Get the `slugEditor` property for an entry draft.
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
 * Get the `originalPath` property for an entry draft, which is the folder an entry is stored in,
 * relative to the collection folder. It’s only used when the `meta.path` option is enabled, which
 * lets the user move an entry by editing the path in the editor.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection that the entry belongs to.
 * @param {any} args.originalEntry Entry to be edited, or a partial {@link Entry} object.
 * @param {string} [args.initialPath] Folder for a new entry, passed through the `path` URL
 * parameter. Defaults to the folder the user is currently browsing.
 * @returns {string | undefined} Folder path, or `undefined` if the path editor is disabled.
 */
export const getOriginalPath = ({ collection, originalEntry, initialPath }) => {
  if (!getMetaPathConfig(collection)) {
    return undefined;
  }

  const { subPath } = originalEntry;

  if (typeof subPath === 'string') {
    return getEntryDirPath(subPath);
  }

  return stripSlashes(initialPath ?? nestedFilterPath.current);
};

/**
 * Build an entry draft object. This only assembles the values; it’s {@link createDraft} that opens
 * the draft in the editor. A draft can also be built on its own to check an entry that isn’t being
 * edited, in which case the application state is left untouched.
 *
 * The draft is a deeply reactive `$state` object, so the editor components can read and mutate it
 * directly, and each of them is only updated when a value it actually reads changes.
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
 * @param {string} [args.initialPath] Folder for a new entry in a collection with the `meta.path`
 * option enabled, passed through the `path` URL parameter.
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
  initialPath,
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
    cmsConfig.current?.editor?.preview ??
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

  const originalPath = getOriginalPath({ collection, originalEntry, initialPath });

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

  /** @type {EntryDraft} */
  const draft = createState({
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
    originalPath,
    currentPath: originalPath,
    originalValues,
    // The value proxies are created below, as they need a reference to the reactive draft
    currentValues: {},
    files: {},
    extraValues: extraValues ?? Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    validities: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    validationMessages: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    // Any locale-agnostic view states will be put under the `_` key
    expanderStates: expanderStates ?? { _: {} },
    slugEditor: getSlugEditorProp({ collection, collectionFile, originalSlugs }),
    interacted: false,
  });

  enabledLocales.forEach((locale) => {
    draft.currentValues[locale] = createProxy({
      draft,
      locale,
      target: structuredClone(originalValues[locale]),
    });
  });

  return draft;
};

/**
 * Create an entry draft and open it in the editor.
 * @param {object} args Arguments. See {@link buildDraft} for the rest.
 * @param {EntryDraftState} args.entryDraft Entry draft state of the editor to open the draft in.
 * Any draft currently held there is replaced.
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
 * @param {string} [args.initialPath] Folder for a new entry in a collection with the `meta.path`
 * option enabled, passed through the `path` URL parameter.
 * @param {boolean} [args.isIndexFile] Whether to edit the collection’s index file.
 * @returns {EntryDraft} Created draft.
 */
export const createDraft = ({ entryDraft, ...args }) => {
  const { originalEntry = {} } = args;

  // Custom field validation state is keyed by locale and key path only, so discard it to prevent
  // verdicts from a previous draft leaking into this one
  resetCustomFieldValidation();
  // The outgoing draft’s unsaved files are about to become unreachable; release what they hold
  revokeDraftFileURLs(entryDraft.current);

  const draft = buildDraft(args);

  entryDraft.current = draft;

  // An entry awaiting deletion is read-only, so a cached draft would be neither restorable nor
  // useful
  if (!isPendingDeletion(originalEntry)) {
    restoreBackupIfNeeded({ draft });
  }

  return draft;
};
