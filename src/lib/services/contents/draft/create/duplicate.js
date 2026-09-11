import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder';
import { getEntryDirPath, getSharedEntryFileName } from '$lib/services/contents/collection/nested';
import { getSlugEditorProp } from '$lib/services/contents/draft/create';
import { createProxy } from '$lib/services/contents/draft/create/proxy.svelte';
import { showDuplicateToast } from '$lib/services/contents/editor';
import { getAliasesKey, removeAliases } from '$lib/services/contents/entry/aliases';
import { getField, LIST_KEY_PATH_REGEX } from '$lib/services/contents/entry/fields';
import { getDefaultValueMap as getHiddenFieldDefaultValueMap } from '$lib/services/contents/fields/hidden/defaults';
import { getInitialValue as getInitialUuidValue } from '$lib/services/contents/fields/uuid/helpers';
import { createState, getSnapshot } from '$lib/services/utils/state.svelte';

/**
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 * @import { EntryDraft, LocaleContentMap } from '$lib/types/private';
 * @import { HiddenField, UuidField } from '$lib/types/public';
 */

/**
 * Duplicate the entry draft open in the editor, replacing it with the duplicate.
 * @param {EntryDraftState} entryDraft Entry draft state.
 * @returns {EntryDraft} Duplicated draft.
 */
export const duplicateDraft = (entryDraft) => {
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

    // Reset some unique values
    Object.keys(valueMap).forEach((keyPath) => {
      const fieldConfig = getField({ ...getFieldArgs, keyPath });

      if (fieldConfig?.widget === 'uuid') {
        if (locale === defaultLocale || [true, 'translate'].includes(fieldConfig?.i18n ?? false)) {
          valueMap[keyPath] = getInitialUuidValue(/** @type {UuidField} */ (fieldConfig));
        }
      }

      if (fieldConfig?.widget === 'hidden') {
        // The value could be array; normalize the key path, e.g. `tags.0` -> `tags`
        if (Array.isArray(fieldConfig.default) && LIST_KEY_PATH_REGEX.test(keyPath)) {
          delete valueMap[keyPath];
          keyPath = keyPath.replace(LIST_KEY_PATH_REGEX, '');

          if (keyPath in valueMap) {
            return;
          }
        }

        if (locale === defaultLocale || [true, 'translate'].includes(fieldConfig?.i18n ?? false)) {
          Object.assign(
            valueMap,
            getHiddenFieldDefaultValueMap({
              fieldConfig: /** @type {HiddenField} */ (fieldConfig),
              keyPath,
              locale,
              defaultLocale,
            }),
          );
        }
      }
    });
  });

  const { currentPath } = draft;

  const duplicatePath =
    currentPath !== undefined && getSharedEntryFileName(collection)
      ? getEntryDirPath(currentPath)
      : currentPath;

  // The original draft is discarded, so the rest of its state can be carried over as is
  /** @type {EntryDraft} */
  const newDraft = createState({
    ...draft,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    isNew: true,
    originalEntry: undefined,
    originalSlugs: {},
    currentSlugs: {},
    // The duplicate is filed alongside the original, not inside it. Where every entry owns a
    // folder, `currentPath` is the original’s own folder, so the copy has to start from its parent
    // and get a folder of its own there
    originalPath: duplicatePath,
    currentPath: duplicatePath,
    // The value proxies are created below, as they need a reference to the new draft
    currentValues: {},
    // Reset the validities
    validities: Object.fromEntries(Object.keys(draft.validities).map((locale) => [locale, {}])),
    slugEditor: getSlugEditorProp({ collection, collectionFile, originalSlugs: {} }),
    interacted: false,
  });

  Object.entries(currentValues).forEach(([locale, valueMap]) => {
    newDraft.currentValues[locale] = createProxy({ draft: newDraft, locale, target: valueMap });
  });

  entryDraft.current = newDraft;
  showDuplicateToast.set(true);

  return newDraft;
};
