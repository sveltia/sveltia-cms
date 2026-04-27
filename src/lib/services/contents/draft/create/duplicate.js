import { get } from 'svelte/store';

import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder';
import { entryDraft } from '$lib/services/contents/draft';
import { getSlugEditorProp } from '$lib/services/contents/draft/create';
import { showDuplicateToast } from '$lib/services/contents/editor';
import { getField } from '$lib/services/contents/entry/fields';
import { getDefaultValueMap as getHiddenFieldDefaultValueMap } from '$lib/services/contents/fields/hidden/defaults';
import { getInitialValue as getInitialUuidValue } from '$lib/services/contents/fields/uuid/helper';

/**
 * @import { EntryDraft } from '$lib/types/private';
 * @import { HiddenField, UuidField } from '$lib/types/public';
 */

/**
 * Duplicate the current entry draft.
 */
export const duplicateDraft = () => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));

  const {
    collectionName,
    fileName,
    collection,
    collectionFile,
    currentValues,
    validities,
    isIndexFile,
  } = draft;

  const {
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey },
  } = (collectionFile ?? collection)._i18n;

  const orderFieldKey = getOrderFieldKey(collection);

  Object.entries(currentValues).forEach(([locale, valueMap]) => {
    // Remove the canonical slug
    delete valueMap[canonicalSlugKey];

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
        if (Array.isArray(fieldConfig.default) && keyPath.match(/\.\d+$/)) {
          delete valueMap[keyPath];
          keyPath = keyPath.replace(/\.\d+$/, '');

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

  // Reset the validities
  Object.keys(validities).forEach((locale) => {
    validities[locale] = {};
  });

  entryDraft.set({
    ...draft,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    isNew: true,
    originalEntry: undefined,
    originalSlugs: {},
    currentSlugs: {},
    slugEditor: getSlugEditorProp({ collection, collectionFile, originalSlugs: {} }),
  });

  showDuplicateToast.set(true);
};
