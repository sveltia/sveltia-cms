import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { getEntryDirPath, getSharedEntryFileName } from '$lib/services/contents/collection/nested';
import { STATIC_DRAFT_KEYS } from '$lib/services/contents/draft';
import { getSlugEditorProp } from '$lib/services/contents/draft/create';
import { copyEntryRelativeAssets } from '$lib/services/contents/draft/create/duplicate-assets';
import { createProxy } from '$lib/services/contents/draft/create/proxy.svelte';
import { showDuplicateToast } from '$lib/services/contents/editor';
import { getAliasesKey, removeAliases } from '$lib/services/contents/entry/aliases';
import { getField } from '$lib/services/contents/entry/fields';
import { hasUuidTag } from '$lib/services/contents/fields/compute/helpers';
import { getDefaultValueMap as getHiddenFieldDefaultValueMap } from '$lib/services/contents/fields/hidden/defaults';
import { getInitialValue as getInitialUuidValue } from '$lib/services/contents/fields/uuid/helpers';
import { isFieldLocalized, isFieldTranslatable } from '$lib/services/contents/i18n/fields';
import { createState, getSnapshot } from '$lib/services/utils/state.svelte';

/**
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 * @import { EntryDraft, GetFieldArgs, LocaleContentMap } from '$lib/types/private';
 * @import { ComputeField, FieldKeyPath, HiddenField, UuidField } from '$lib/types/public';
 */

/**
 * Find the Hidden field the given key path belongs to. A Hidden field takes a value of any shape,
 * and an object or array value is flattened into key paths below the field’s own, like `tags.0`,
 * which no field configuration describes, so look for the field along the key path from the top.
 * @param {GetFieldArgs} args Arguments.
 * @returns {{ fieldConfig: HiddenField, keyPath: FieldKeyPath } | undefined} The field and its key
 * path, or `undefined` if the key path doesn’t belong to a Hidden field.
 */
const findHiddenField = ({ keyPath, ...getFieldArgs }) => {
  const segments = keyPath.split('.');

  for (let length = 1; length <= segments.length; length += 1) {
    const parentKeyPath = segments.slice(0, length).join('.');
    const fieldConfig = getField({ ...getFieldArgs, keyPath: parentKeyPath });

    if (fieldConfig?.widget === 'hidden') {
      return { fieldConfig: /** @type {HiddenField} */ (fieldConfig), keyPath: parentKeyPath };
    }
  }

  return undefined;
};

/**
 * Duplicate the entry draft open in the editor, replacing it with the duplicate.
 * @param {EntryDraftState} entryDraft Entry draft state.
 * @returns {Promise<EntryDraft | undefined>} Duplicated draft, or `undefined` if the editor was
 * closed or given another draft while the original’s assets were being copied.
 */
export const duplicateDraft = async (entryDraft) => {
  const draft = /** @type {EntryDraft} */ (entryDraft.current);
  const { collectionName, fileName, collection, collectionFile, fields, isIndexFile } = draft;

  const {
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey },
  } = (collectionFile ?? collection)._i18n;

  const orderFieldKey = getOrderFieldKey(collection);
  const aliasesKey = getAliasesKey({ collection, fields });

  // Work on detached copies of the values: the duplicate gets value proxies of its own below, and
  // changing the original draft’s values here would needlessly run their revalidation
  /** @type {LocaleContentMap} */
  const currentValues = Object.fromEntries(
    Object.entries(draft.currentValues).map(([locale, valueMap]) => [
      locale,
      getSnapshot(valueMap),
    ]),
  );

  Object.entries(currentValues).forEach(([locale, valueMap]) => {
    // Remove the canonical slug
    delete valueMap[canonicalSlugKey];

    // Remove any redirects from the original entry’s previous paths, which must not be claimed by
    // more than one entry
    removeAliases(valueMap, aliasesKey);

    // Drop the manual sort order; a fresh value will be assigned at save time so the duplicate gets
    // a unique order even after backup/restore round trips
    if (orderFieldKey) {
      delete valueMap[orderFieldKey];
    }

    const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };
    /** @type {Map<FieldKeyPath, HiddenField>} */
    const hiddenFields = new Map();

    // Reset some unique values
    Object.keys(valueMap).forEach((keyPath) => {
      const fieldConfig = getField({ ...getFieldArgs, keyPath });

      if (fieldConfig?.widget === 'uuid') {
        if (locale === defaultLocale || isFieldTranslatable(fieldConfig?.i18n)) {
          valueMap[keyPath] = getInitialUuidValue(/** @type {UuidField} */ (fieldConfig));
        }
      }

      // A Compute field keeps the UUIDs found in its current value when it’s resolved again, so
      // the value has to be cleared for the duplicate to get UUIDs of its own. The field is
      // resolved as soon as the new draft is in place
      if (
        fieldConfig?.widget === 'compute' &&
        hasUuidTag(/** @type {ComputeField} */ (fieldConfig).value)
      ) {
        if (locale === defaultLocale || isFieldLocalized(fieldConfig?.i18n)) {
          valueMap[keyPath] = '';
        }
      }

      const hidden = findHiddenField({ ...getFieldArgs, keyPath });

      if (hidden && (locale === defaultLocale || isFieldTranslatable(hidden.fieldConfig.i18n))) {
        // An object or array value is flattened into key paths below the field’s own, e.g.
        // `tags.0`, which are replaced along with it
        delete valueMap[keyPath];
        hiddenFields.set(hidden.keyPath, hidden.fieldConfig);
      }
    });

    // Fill in the defaults once all the old values are gone, so a key path that comes after its
    // own items, like `tags` after `tags.0`, doesn’t take the default away again
    hiddenFields.forEach((fieldConfig, keyPath) => {
      Object.assign(
        valueMap,
        getHiddenFieldDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale }),
      );
    });
  });

  // The original’s own assets have to be copied along with the entry, or the duplicate would
  // reference files that only exist next to the original
  // @see https://github.com/sveltia/sveltia-cms/issues/526
  const files = { ...draft.files, ...(await copyEntryRelativeAssets({ draft, currentValues })) };

  if (entryDraft.current !== draft) {
    return undefined;
  }

  const { currentPath } = draft;

  const duplicatePath =
    currentPath !== undefined && getSharedEntryFileName(collection)
      ? getEntryDirPath(currentPath)
      : currentPath;

  // The original draft is discarded, so the rest of its state can be carried over as is
  /** @type {EntryDraft} */
  const newDraft = createState(
    {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      isNew: true,
      originalEntry: undefined,
      originalSlugs: {},
      currentSlugs: {},
      // The duplicate is filed alongside the original, not inside it. Where every entry owns a
      // folder, `currentPath` is the original’s own folder, so the copy has to start from its
      // parent and get a folder of its own there
      originalPath: duplicatePath,
      currentPath: duplicatePath,
      // The value proxies are created below, as they need a reference to the new draft
      currentValues: {},
      files,
      // Reset the validities
      validities: Object.fromEntries(Object.keys(draft.validities).map((locale) => [locale, {}])),
      slugEditor: getSlugEditorProp({ collection, collectionFile, originalSlugs: {} }),
      interacted: false,
    },
    STATIC_DRAFT_KEYS,
  );

  Object.entries(currentValues).forEach(([locale, valueMap]) => {
    newDraft.currentValues[locale] = createProxy({ draft: newDraft, locale, target: valueMap });
  });

  entryDraft.current = newDraft;
  showDuplicateToast.current = true;

  return newDraft;
};
