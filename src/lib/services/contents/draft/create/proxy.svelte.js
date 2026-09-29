import { resolveCollectionAndFile } from '$lib/services/contents/collection/files';
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
 * Get the `i18n` option that applies to the given field: its own, or, if the field has none, that
 * of the nearest ancestor that has one, such as the List or Object field it belongs to.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the key
 * path of the field.
 * @returns {Field['i18n']} Option, or `undefined` if neither the field nor its ancestors have one.
 */
export const getInheritedI18nOption = ({ fieldConfig, getFieldArgs }) => {
  if (fieldConfig.i18n !== undefined) {
    return fieldConfig.i18n;
  }

  const segments = getFieldArgs.keyPath.split('.');

  // Look at the ancestors from the nearest one, skipping the list item indexes, which aren’t fields
  // of their own, e.g. `items` for `items.0.name`
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    if (!/^\d+$/.test(segments[index])) {
      const { i18n } =
        getField({ ...getFieldArgs, keyPath: segments.slice(0, index + 1).join('.') }) ?? {};

      if (i18n !== undefined) {
        return i18n;
      }
    }
  }

  return undefined;
};

/**
 * Check if the given field’s value is duplicated from the default locale to the other locales. That
 * is the case when the field has the `duplicate` i18n strategy, or, if the field has no `i18n`
 * option of its own, when the nearest ancestor that has one, such as the List or Object field it
 * belongs to, has the `duplicate` strategy. A duplicated List or Object field then holds the same
 * items and values in every locale, the way `normalizeContentMap()` copies it when an entry is
 * loaded, while a subfield explicitly made translatable keeps a value of its own in each locale.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the key
 * path of the field.
 * @returns {boolean} Whether the value is duplicated.
 */
export const isDuplicatedField = (args) => getInheritedI18nOption(args) === 'duplicate';

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

      // `getField()` is memoized, while the key scan walks the whole locale’s content through the
      // `$state` proxy, so a configured parent — the usual case — never pays for the scan
      if (
        !getField({ ...getFieldArgs, keyPath: parentKeyPath }) &&
        !Object.keys(content).some((_keyPath) => _keyPath.startsWith(`${parentKeyPath}.`))
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
 * or deleted, and automatically copies the value to the other locales if the field’s i18n strategy
 * is `duplicate`.
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
  const resolved = resolveCollectionAndFile(collectionName, fileName);

  if (!resolved) {
    return undefined;
  }

  const { collection, collectionFile } = resolved;

  const {
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey },
  } = (collectionFile ?? collection)._i18n;

  /**
   * Check if auto-duplication should be performed for the given field.
   * @param {Field} fieldConfig Field configuration.
   * @param {GetFieldArgs} getFieldArgs Arguments for the `getField` function.
   * @returns {boolean} True if auto-duplication should be performed.
   */
  const shouldAutoDuplicate = (fieldConfig, getFieldArgs) =>
    isAutoDuplicationEnabled() &&
    sourceLanguage === defaultLocale &&
    isDuplicatedField({ fieldConfig, getFieldArgs });

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

      // Update the validity and validation message in real time if validation has already been
      // performed. A value without a field of its own may be a KeyValue pair, which is validated
      // as part of its field, so that’s left to `revalidateField()` to tell
      revalidateField({ draft, locale: sourceLanguage, keyPath, value, valueMap });

      if (!fieldConfig) {
        return true;
      }

      // Copy value to other locales
      if (shouldAutoDuplicate(fieldConfig, getFieldArgs)) {
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

      const { fieldConfig, getFieldArgs, valueMap } = getFieldInfo(obj, keyPath);

      // Update the validity and validation message in real time as well, e.g. when the last item of
      // a List field is removed, which leaves the list with fewer items than it had
      if (keyPath !== canonicalSlugKey) {
        revalidateField({ draft, locale: sourceLanguage, keyPath, value: undefined, valueMap });
      }

      if (!fieldConfig) {
        return true;
      }

      // Remove the property from other locales
      if (shouldAutoDuplicate(fieldConfig, getFieldArgs)) {
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
