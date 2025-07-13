import { get } from 'svelte/store';
import { entryDraft } from '$lib/services/contents/draft';
import { showDuplicateToast } from '$lib/services/contents/draft/editor';
import { getField } from '$lib/services/contents/entry/fields';
import { getDefaultValueMap as getHiddenFieldDefaultValueMap } from '$lib/services/contents/widgets/hidden/helper';
import { getInitialValue as getInitialUuidValue } from '$lib/services/contents/widgets/uuid/helper';

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

  Object.entries(currentValues).forEach(([locale, valueMap]) => {
    // Remove the canonical slug
    delete valueMap[canonicalSlugKey];

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
              // eslint-disable-next-line object-shorthand
              fieldConfig: /** @type {HiddenField} */ (fieldConfig),
              keyPath,
              locale,
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
    isNew: true,
    originalEntry: undefined,
    originalSlugs: {},
    currentSlugs: {},
  });

  showDuplicateToast.set(true);
};
