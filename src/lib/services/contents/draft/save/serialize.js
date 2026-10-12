import { toRaw } from '@sveltia/utils/object';
import { compare } from '@sveltia/utils/string';
import { TomlDate } from 'smol-toml';

import { cmsConfig } from '$lib/services/config';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { INTERNAL_PROP_REGEX } from '$lib/services/contents/draft';
import { getInheritedI18nOption } from '$lib/services/contents/draft/create/proxy.svelte';
import { createKeyPathList } from '$lib/services/contents/draft/save/key-path';
import { getAliasesKey, getAliasKeyPaths } from '$lib/services/contents/entry/aliases';
import {
  getField,
  getFieldKind,
  hasRootField,
  isFieldRequired,
} from '$lib/services/contents/entry/fields';
import { getWildcardKeyPathPattern } from '$lib/services/contents/entry/key-paths';
import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';
import { resolveFileConfig } from '$lib/services/contents/file/config';
import { TOML_FORMATS } from '$lib/services/contents/file/constants';
import { isFieldLocalized } from '$lib/services/contents/i18n/fields';
import { getOrCreate } from '$lib/services/utils/cache';
import { hasIndexLikeChildKey, isValueEmpty, unflattenKeys } from '$lib/services/utils/object';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { DateTimeField, Field, FileFormat, RawEntryContent } from '$lib/types/public';
 */

/**
 * Cache of wildcard key-path regexes used in {@link finalizeContent}, keyed by `keyPath`.
 * @type {Map<string, RegExp>}
 */
const wildcardKeyPathRegexCache = new Map();

/**
 * Get a regular expression that matches a concrete key path of a wildcard key path, or any key path
 * below it, capturing the concrete key path, e.g. `list.0.title` in `list.0.title` and
 * `list.0.pairs` in `list.0.pairs.foo` for `list.*.title` and `list.*.pairs` respectively.
 * @param {string} keyPath Key path that may contain wildcards.
 * @returns {RegExp} Regular expression.
 */
const getWildcardKeyPathRegex = (keyPath) =>
  getOrCreate(
    wildcardKeyPathRegexCache,
    keyPath,
    () => new RegExp(`^(${getWildcardKeyPathPattern(keyPath)})(?:\\.|$)`),
  );

/**
 * Move a property name/value from a unsorted property map to a sorted property map.
 * @param {object} args Arguments.
 * @param {string} args.key Property name.
 * @param {Field} [args.field] Associated field.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.unsortedMap Unsorted property map.
 * @param {FlattenedEntryContent} args.sortedMap Sorted property map.
 * @param {boolean} args.isTomlOutput Whether the output it TOML format.
 * @param {boolean} args.omitEmptyOptionalFields Whether to prevent fields with `required: false`
 * and an empty value from being included in the data output.
 */
export const copyProperty = ({
  key,
  field,
  locale,
  unsortedMap,
  sortedMap,
  isTomlOutput,
  omitEmptyOptionalFields,
}) => {
  // Skip internal properties added to list items
  if (INTERNAL_PROP_REGEX.test(key)) {
    delete unsortedMap[key];
    return;
  }

  let value = unsortedMap[key];

  // Use native date for TOML if a custom format is not defined
  // @see https://github.com/squirrelchat/smol-toml?tab=readme-ov-file#dates
  // @see https://toml.io/en/v1.0.0#offset-date-time
  if (
    isTomlOutput &&
    field?.widget === 'datetime' &&
    !parseDateTimeConfig(/** @type {DateTimeField} */ (field)).format
  ) {
    if (isValueEmpty(value)) {
      // An optional field without a value saves nothing. We cannot save `null` because TOML
      // doesn’t support it, and an empty string may not be the expected value for a date field
      value = undefined;
    } else {
      const tomlDate = new TomlDate(value);

      // A date, a time or a date-time, with or without an offset, becomes a native TOML value. Any
      // other value, e.g. `TBD`, `2024-01` or `3:04 PM`, which a field without a date or a time can
      // hold, is kept as a string
      if (tomlDate.isValid()) {
        value = tomlDate;
      }
    }
  }

  if (
    omitEmptyOptionalFields &&
    field &&
    !isFieldRequired({ fieldConfig: field, locale }) &&
    isValueEmpty(value)
  ) {
    const childKeys = Object.keys(unsortedMap).filter((_key) => _key.startsWith(`${key}.`));

    if (
      childKeys.some((_key) => !INTERNAL_PROP_REGEX.test(_key) && !isValueEmpty(unsortedMap[_key]))
    ) {
      // Preserve the parent because it has non-empty children
      sortedMap[key] = value;
    } else {
      // Omit the empty value and remove any empty children so they are not processed later
      childKeys.forEach((_key) => {
        delete unsortedMap[_key];
      });
    }
  } else {
    sortedMap[key] = value;
  }

  delete unsortedMap[key];
};

/**
 * Field types whose object or array value is flattened into key paths that no field configuration
 * describes: a Hidden field takes anything its `default` or the file gives it, and a Code field
 * saves the code and the language under the property names of its `keys` option.
 */
const OPAQUE_FIELD_TYPES = ['code', 'hidden'];

/**
 * Check whether the given field holds a value whose properties no field configuration describes: a
 * custom field, or one of {@link OPAQUE_FIELD_TYPES}.
 * @param {Field} field Field configuration.
 * @returns {boolean} Result.
 */
const isOpaqueField = (field) =>
  OPAQUE_FIELD_TYPES.includes(String(field.widget)) || getFieldKind(field) === 'custom';

/**
 * Shared state of a {@link finalizeContent} run, passed to the helpers that copy the fields.
 * @typedef {object} FinalizeContext
 * @property {InternalLocaleCode} locale Locale code.
 * @property {InternalLocaleCode} defaultLocale Default locale code, or `_default` if i18n is not
 * enabled.
 * @property {{ collectionName: string, fileName?: string, valueMap: FlattenedEntryContent,
 * isIndexFile: boolean }} getFieldArgs Arguments for `getField()`, without the key path.
 * @property {FlattenedEntryContent} unsortedMap Unsorted property map.
 * @property {FlattenedEntryContent} sortedMap Sorted property map.
 * @property {{ locale: InternalLocaleCode, unsortedMap: FlattenedEntryContent, sortedMap:
 * FlattenedEntryContent, isTomlOutput: boolean, omitEmptyOptionalFields: boolean }} copyArgs
 * Arguments for {@link copyProperty}, without the key and the field.
 */

/**
 * Check whether the field at the given key path belongs in the locale’s content. Every field does
 * in the default locale, but in another locale, only one that is localized along with all of its
 * ancestors, as the others are left out of that locale’s content.
 * @param {FinalizeContext} ctx Context.
 * @param {string} keyPath Concrete key path of the field.
 * @returns {boolean} Result.
 */
const isFieldInLocale = ({ locale, defaultLocale, getFieldArgs }, keyPath) => {
  if (locale === defaultLocale) {
    return true;
  }

  const segments = keyPath.split('.');

  // Skip the list item indexes, which aren’t fields of their own, e.g. `items.0` in `items.0.kv`
  return segments.every((segment, index) => {
    if (index < segments.length - 1 && /^\d+$/.test(segment)) {
      return true;
    }

    const args = { ...getFieldArgs, keyPath: segments.slice(0, index + 1).join('.') };
    const fieldConfig = getField(args);

    return (
      !!fieldConfig && isFieldLocalized(getInheritedI18nOption({ fieldConfig, getFieldArgs: args }))
    );
  });
};

/**
 * Copy a KeyValue field’s key-value pairs to the sorted property map.
 * @param {FinalizeContext} ctx Context.
 * @param {string} keyPath Concrete key path of the field.
 * @param {Field} field Field configuration.
 */
const copyKeyValueField = (ctx, keyPath, field) => {
  const { unsortedMap, sortedMap, copyArgs } = ctx;
  const prefix = `${keyPath}.`;

  const pairKeyPaths = Object.keys(unsortedMap).filter((_keyPath) => {
    if (!_keyPath.startsWith(prefix)) {
      return false;
    }

    // A blank pair, like the one a required field gets as its default value, isn’t saved.
    // Validation doesn’t count it either, so it can only be left in an optional field. A pair with
    // an empty key but a value, which a file can hold, is kept as is
    if (!_keyPath.slice(prefix.length).trim() && !unsortedMap[_keyPath]) {
      delete unsortedMap[_keyPath];

      return false;
    }

    return true;
  });

  // A field without pairs is saved as an empty object, just like a List field without items is
  // saved as an empty array, whether or not it holds the `null` placeholder the editor stores to
  // have the field validated. Whether it does depends on whether its editor has been shown, so it
  // can’t make a difference to the output. `copyProperty()` still omits the empty object if the
  // field is optional and the `omit_empty_optional_fields` output option is enabled
  if (!pairKeyPaths.length) {
    // A field that isn’t in the locale’s content, e.g. one that isn’t translatable in a locale
    // other than the default, doesn’t get the empty object either
    if (Object.hasOwn(unsortedMap, keyPath) || isFieldInLocale(ctx, keyPath)) {
      // Any other value, such as a string where the file doesn’t hold an object, is left as is
      unsortedMap[keyPath] ??= {};
      copyProperty({ ...copyArgs, key: keyPath, field });
    }

    return;
  }

  // Work around a bug in the flat library where numeric property keys used for KeyValue fields
  // trigger a wrong conversion to an array instead of an object
  // @see https://github.com/hughsk/flat/issues/103
  sortedMap[keyPath] = {};
  delete unsortedMap[keyPath];

  pairKeyPaths.forEach((_keyPath) => {
    copyProperty({ ...copyArgs, key: _keyPath, field });
  });
};

/**
 * Copy the value of a custom or Hidden field to the sorted property map. An object or array value
 * is flattened into the key paths below the field’s own, which aren’t listed in the configured
 * fields. Copy them right away, in the order the control or the file gave the properties, rather
 * than leaving them to be sorted with the remainder at the end of the output.
 * @param {FinalizeContext} ctx Context.
 * @param {string} keyPath Concrete key path of the field.
 * @param {Field} field Field configuration.
 */
const copyOpaqueField = ({ unsortedMap, copyArgs }, keyPath, field) => {
  if (Object.hasOwn(unsortedMap, keyPath)) {
    copyProperty({ ...copyArgs, key: keyPath, field });
  }

  const prefix = `${keyPath}.`;

  Object.keys(unsortedMap)
    .filter((_keyPath) => _keyPath.startsWith(prefix))
    .forEach((_keyPath) => {
      copyProperty({ ...copyArgs, key: _keyPath });
    });
};

/**
 * Add an empty object as a placeholder for an Object field whose subfields include one named like a
 * list index, e.g. `2024`, so it’s not unflattened into an array. A value read from a file already
 * has one, but a new entry or a newly added object doesn’t.
 * @param {FinalizeContext} ctx Context.
 * @param {string} keyPath Concrete key path of the field.
 * @param {Field} [field] Field configuration.
 */
const addObjectPlaceholder = ({ unsortedMap, sortedMap }, keyPath, field) => {
  if (field?.widget === 'object' && hasIndexLikeChildKey(unsortedMap, keyPath)) {
    sortedMap[keyPath] = {};
  }
};

/**
 * Copy the value of a field to the sorted property map, dispatching a KeyValue field and an opaque
 * field to their own handlers. A KeyValue field is handled on its own, even if it holds a value at
 * its own key path, which is the placeholder of an empty field. A key path with wildcards is never
 * dispatched, as it has to be resolved to the concrete key paths of the list items first.
 * @param {FinalizeContext} ctx Context.
 * @param {string} keyPath Key path of the field.
 * @param {Field | undefined} field Field configuration.
 * @returns {boolean} Whether the field has been handled. `false` if the key path holds no value,
 * leaving it to the caller to resolve its wildcards or add a placeholder.
 */
const copyField = (ctx, keyPath, field) => {
  const isConcrete = !keyPath.includes('*');

  if (field?.widget === 'keyvalue' && isConcrete) {
    copyKeyValueField(ctx, keyPath, field);
  } else if (field && isConcrete && isOpaqueField(field)) {
    copyOpaqueField(ctx, keyPath, field);
  } else if (Object.hasOwn(ctx.unsortedMap, keyPath)) {
    copyProperty({ ...ctx.copyArgs, key: keyPath, field });
  } else {
    return false;
  }

  return true;
};

/**
 * Copy the values of a wildcard key path’s concrete key paths to the sorted property map, resolving
 * the wildcards to the list items, e.g. `list.*.title` → `list.0.title`, `list.1.title`. A KeyValue
 * field has no value at its own key path when it holds pairs, so look for the key paths below it as
 * well.
 * @param {FinalizeContext} ctx Context.
 * @param {string} keyPath Key path that may contain wildcards.
 * @param {Field | undefined} field Field configuration.
 */
const copyWildcardField = (ctx, keyPath, field) => {
  const regex = getWildcardKeyPathRegex(keyPath);

  const concreteKeyPaths = new Set(
    Object.keys(ctx.unsortedMap)
      .map((_keyPath) => _keyPath.match(regex)?.[1])
      .filter((_keyPath) => _keyPath !== undefined),
  );

  [...concreteKeyPaths]
    .sort((a, b) => compare(a, b))
    .forEach((concreteKeyPath) => {
      // When the wildcard path couldn’t resolve a typed list field, resolve with the concrete key
      // path so that field metadata (e.g. `required`) is available to `copyProperty`
      const resolvedField = field ?? getField({ ...ctx.getFieldArgs, keyPath: concreteKeyPath });

      if (!copyField(ctx, concreteKeyPath, resolvedField)) {
        addObjectPlaceholder(ctx, concreteKeyPath, resolvedField);
      }
    });
};

/**
 * Finalize the content by sorting the entry draft content’s object properties by the order of the
 * configured collection fields. The result can be formatted as expected with `JSON.stringify()`, as
 * the built-in method uses insertion order for string key ordering.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {Field[]} args.fields Field list of a collection or a file.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {InternalLocaleCode} args.defaultLocale Default locale code, or `_default` if i18n is not
 * enabled.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content.
 * @param {string} [args.canonicalSlugKey] Property name of a canonical slug.
 * @param {string} [args.aliasesKey] Property name of the entry’s URL aliases. Placed right after
 * the canonical slug, ahead of all configured fields, when present in the value map.
 * @param {string} [args.orderKey] Property name of the entry order field. Placed right after the
 * aliases, ahead of all configured fields, when present in the value map.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {boolean} [args.isTomlOutput] Whether the output it TOML format.
 * @returns {RawEntryContent} Unflattened entry content sorted by fields. Output order is: canonical
 * slug → aliases → order → configured fields → remainder.
 */
const finalizeContent = ({
  collectionName,
  fileName,
  fields,
  locale,
  defaultLocale,
  valueMap,
  canonicalSlugKey,
  aliasesKey,
  orderKey,
  isIndexFile = false,
  isTomlOutput = false,
}) => {
  /** @type {FlattenedEntryContent} */
  const unsortedMap = toRaw(valueMap);
  /** @type {FlattenedEntryContent} */
  const sortedMap = {};

  const { omit_empty_optional_fields: omitEmptyOptionalFields = false } =
    cmsConfig.current?.output ?? {};

  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };
  const copyArgs = { locale, unsortedMap, sortedMap, isTomlOutput, omitEmptyOptionalFields };
  /** @type {FinalizeContext} */
  const ctx = { locale, defaultLocale, getFieldArgs, unsortedMap, sortedMap, copyArgs };

  // Add the slug first
  if (canonicalSlugKey && Object.hasOwn(unsortedMap, canonicalSlugKey)) {
    copyProperty({ ...copyArgs, key: canonicalSlugKey });
  }

  // Add the URL aliases next so they appear at the top of the output, close to the slug they relate
  // to. The property normally holds a list, which is flattened into indexed key paths, but copy the
  // property itself too in case the user stores something else in it
  if (aliasesKey) {
    if (Object.hasOwn(unsortedMap, aliasesKey)) {
      copyProperty({ ...copyArgs, key: aliasesKey });
    }

    getAliasKeyPaths(unsortedMap, aliasesKey).forEach((keyPath) => {
      copyProperty({ ...copyArgs, key: keyPath });
    });
  }

  // Add the order field next so it appears at the top of the output
  if (orderKey && Object.hasOwn(unsortedMap, orderKey)) {
    copyProperty({ ...copyArgs, key: orderKey });
  }

  // Move the listed properties to a new object
  createKeyPathList(fields).forEach((keyPath) => {
    const field = getField({ ...getFieldArgs, keyPath });

    if (!copyField(ctx, keyPath, field)) {
      copyWildcardField(ctx, keyPath, field);
    }
  });

  // Move the remainder, if any, to a new object. Sorting also guarantees that a parent key path
  // precedes its own children, which `unflatten()` below depends on to keep the children
  Object.keys(unsortedMap)
    .sort((a, b) => compare(a, b))
    .forEach((key) => {
      copyProperty({ ...copyArgs, key });
    });

  return unflattenKeys(sortedMap);
};

/**
 * Serialize the content for the output.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Original content.
 * @param {FileFormat} [args.format] Format of the file being saved. In a collection in the
 * `frontmatter` format, it’s the front matter format detected in the existing file, which decides
 * whether dates are written as native TOML dates. Defaults to the configured format.
 * @returns {RawEntryContent} Modified and unflattened content.
 */
export const serializeContent = ({ draft, locale, valueMap, format }) => {
  const { collection, collectionName, collectionFile, fields, isIndexFile } = draft;

  const {
    _i18n: {
      defaultLocale,
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const isTomlOutput = TOML_FORMATS.includes(
    format ?? resolveFileConfig({ collection, collectionFile, isIndexFile }).format,
  );

  const content = finalizeContent({
    collectionName,
    fileName: collectionFile?.name,
    fields,
    locale,
    defaultLocale,
    valueMap,
    canonicalSlugKey,
    aliasesKey: getAliasesKey({ collection, fields }),
    orderKey: getOrderFieldKey(collection),
    isIndexFile,
    isTomlOutput,
  });

  // Handle a special case: top-level List field. TOML doesn’t support top-level arrays, so we
  // ignore the `root` option for such cases.
  if (!isTomlOutput && hasRootField(fields, 'list')) {
    return content[fields[0].name] ?? [];
  }

  // Handle a special case: top-level KeyValue field
  if (hasRootField(fields, 'keyvalue')) {
    return content[fields[0].name] ?? {};
  }

  return content;
};
