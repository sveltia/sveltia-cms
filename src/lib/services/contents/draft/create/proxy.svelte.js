import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { isAutoDuplicationEnabled } from '$lib/services/contents/draft';
import { revalidateField } from '$lib/services/contents/draft/validate/fields';
import { getField } from '$lib/services/contents/entry/fields';
import { getLocalizedRelationValue } from '$lib/services/contents/fields/relation/helpers/locale';

/**
 * @import { EntryDraft, FlattenedEntryContent, GetFieldArgs } from '$lib/types/private';
 * @import { Field, FieldKeyPath, LocaleCode } from '$lib/types/public';
 */

const PATH_MATCH_REGEX = /(?<path>.+?)\.[^.]*$/;
/**
 * Property key on a value map proxy that yields the map’s version. See {@link getValueMapVersion}.
 */
const VERSION_KEY = Symbol('valueMapVersion');

/**
 * Get the version of the given value map, a counter that goes up whenever a value is written to or
 * deleted from the map through the proxy created with {@link createProxy}. Reading it in a reactive
 * context makes that context depend on the whole map at the cost of a single dependency, which is
 * how the shared value map snapshot is kept fresh without every reader walking all the values.
 * @param {FlattenedEntryContent | undefined} valueMap Value map.
 * @returns {number | undefined} Version, or `undefined` if the map is not a proxy.
 */
export const getValueMapVersion = (valueMap) => /** @type {any} */ (valueMap)?.[VERSION_KEY];

/**
 * Copy the default locale value to other locales if the field’s i18n strategy is `duplicate`.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {LocaleCode} args.sourceLanguage Source locale.
 * @param {any} args.value Value to copy to other locales.
 */
export const copyDefaultLocaleValue = ({
  draft,
  getFieldArgs,
  fieldConfig,
  sourceLanguage,
  value,
}) => {
  const { keyPath } = getFieldArgs;

  Object.entries(draft.currentValues).forEach(([targetLanguage, content]) => {
    // Don’t duplicate the value if the parent object doesn’t exist
    if (keyPath.includes('.')) {
      // The regex always matches since keyPath is guaranteed to contain a dot (checked above).
      const parentKeyPath = /** @type {string} */ (keyPath.match(PATH_MATCH_REGEX)?.groups?.path);

      if (
        !Object.keys(content).some((_keyPath) => _keyPath.startsWith(`${parentKeyPath}.`)) &&
        !getField({ ...getFieldArgs, keyPath: parentKeyPath })
      ) {
        return;
      }
    }

    // Keep the source `value` intact, as it’s used for the remaining target locales
    const localizedValue = getLocalizedRelationValue({
      fieldConfig,
      value,
      sourceLocale: sourceLanguage,
      targetLocale: targetLanguage,
    });

    if (targetLanguage !== sourceLanguage && content[keyPath] !== localizedValue) {
      content[keyPath] = localizedValue;
    }
  });
};

/**
 * Create a Proxy holding a locale’s field values, which revalidates a field as its value is written
 * and automatically copies the value to the other locales if the field’s i18n strategy is
 * `duplicate`.
 *
 * The values live in a deeply reactive `$state` object behind the proxy, so a component reading a
 * single value only depends on that value. The proxy also counts its writes; see
 * {@link getValueMapVersion}.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft the values belong to. The draft is read as fields are
 * written, e.g. to find the other locales’ values and update the validities, so it has to be the
 * reactive draft object, not a plain copy.
 * @param {string} args.locale Source locale.
 * @param {FlattenedEntryContent} [args.target] Plain object holding the initial values.
 * @param {() => FlattenedEntryContent} [args.getValueMap] Optional function to get an object
 * holding the current entry values. It will be used for the `valueMap` argument of
 * {@link getField}. If omitted, the proxy target will be used instead.
 * @returns {any} Created proxy.
 */
export const createProxy = ({ draft, locale: sourceLanguage, target = {}, getValueMap }) => {
  const { collectionName, fileName, isIndexFile } = draft;
  const collection = getCollection(collectionName);

  const collectionFile =
    collection && fileName ? getCollectionFile(collection, fileName) : undefined;

  if (!collection || (fileName && !collectionFile)) {
    return undefined;
  }

  const {
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey },
  } = (collectionFile ?? collection)._i18n;

  /**
   * Check if auto-duplication should be performed for the given field.
   * @param {Field} fieldConfig Field configuration.
   * @returns {boolean} True if auto-duplication should be performed.
   */
  const shouldAutoDuplicate = (fieldConfig) =>
    isAutoDuplicationEnabled() &&
    fieldConfig.i18n === 'duplicate' &&
    sourceLanguage === defaultLocale;

  /**
   * Get field configuration for the given key path.
   * @param {object} obj The proxy target object.
   * @param {FieldKeyPath} keyPath The field key path.
   * @returns {{ valueMap: any, getFieldArgs: GetFieldArgs, fieldConfig: Field | undefined }}
   * Field info.
   */
  const getFieldInfo = (obj, keyPath) => {
    const valueMap = typeof getValueMap === 'function' ? getValueMap() : obj;
    /** @type {GetFieldArgs} */
    const getFieldArgs = { collectionName, fileName, keyPath, valueMap, isIndexFile };
    const fieldConfig = getField({ ...getFieldArgs });

    return { valueMap, getFieldArgs, fieldConfig };
  };

  /** @type {FlattenedEntryContent} */
  const values = $state(target);
  let version = $state(0);
  /**
   * Key paths in insertion order. Svelte’s `$state` proxy keeps a deleted key in its target, so a
   * key deleted and written again would otherwise be listed in its old position. That reorders the
   * pairs of a KeyValue field as soon as one of them is renamed, because the editor rewrites all of
   * them, and the order is what the entry file ends up with.
   * This is intentionally a plain `Set`, not a `SvelteSet`: a caller enumerating the keys already
   * depends on the `$state` proxy, which is read in the `ownKeys` trap below.
   * @type {Set<string | symbol>}
   */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const keys = new Set(Object.keys(target));

  return new Proxy(/** @type {any} */ (values), {
    // eslint-disable-next-line jsdoc/require-jsdoc
    get: (obj, key) => (key === VERSION_KEY ? version : obj[key]),
    // eslint-disable-next-line jsdoc/require-jsdoc
    ownKeys: (obj) => {
      // Read the keys through the `$state` proxy, so that a caller enumerating them depends on
      // them; only the order comes from our own list
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      const ownKeys = new Set(Reflect.ownKeys(obj));

      return [
        ...[...keys].filter((key) => ownKeys.has(key)),
        ...[...ownKeys].filter((key) => !keys.has(key)),
      ];
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    set: (obj, /** @type {FieldKeyPath} */ keyPath, value) => {
      if (obj[keyPath] !== value) {
        obj[keyPath] = value;
        keys.add(keyPath);
        version += 1;
      }

      // Skip the rest in some cases
      if ([canonicalSlugKey].includes(keyPath)) {
        return true;
      }

      const { fieldConfig, getFieldArgs, valueMap } = getFieldInfo(obj, keyPath);

      if (!fieldConfig) {
        return true;
      }

      // Update the validity and validation message in real time if validation has already been
      // performed
      revalidateField({ draft, locale: sourceLanguage, keyPath, value, valueMap });

      // Copy value to other locales
      if (shouldAutoDuplicate(fieldConfig)) {
        copyDefaultLocaleValue({ draft, getFieldArgs, fieldConfig, sourceLanguage, value });
      }

      return true;
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    deleteProperty: (obj, /** @type {FieldKeyPath} */ keyPath) => {
      if (keyPath in obj) {
        delete obj[keyPath];
        keys.delete(keyPath);
        version += 1;
      }

      const { fieldConfig } = getFieldInfo(obj, keyPath);

      if (!fieldConfig) {
        return true;
      }

      // Remove the property from other locales
      if (shouldAutoDuplicate(fieldConfig)) {
        Object.entries(draft.currentValues).forEach(([targetLanguage, content]) => {
          if (targetLanguage !== sourceLanguage && keyPath in content) {
            delete content[keyPath];
          }
        });
      }

      return true;
    },
  });
};
