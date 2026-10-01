import { applyTransformations } from '$lib/services/common/transformations';
import { getCollection } from '$lib/services/contents/collection';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getField, isFieldMultiple } from '$lib/services/contents/entry/fields';
import { getKeysByPrefix, getListItemKeys } from '$lib/services/contents/entry/key-paths';
import { getDateTimeFieldDisplayValue } from '$lib/services/contents/fields/date-time/display';
import { getReferencedOptionLabel } from '$lib/services/contents/fields/relation/helpers';
import { getOptionLabel } from '$lib/services/contents/fields/select/helpers';
import { getCanonicalLocale, getListFormatter } from '$lib/services/contents/i18n';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalLocaleCode,
 * PendingEntry,
 * StringTransformation,
 * } from '$lib/types/private';
 * @import {
 * DateTimeField,
 * FieldKeyPath,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * LocaleCode,
 * NumberField,
 * RelationField,
 * SelectField,
 * } from '$lib/types/public';
 */

/**
 * Cache of {@link Intl.NumberFormat} instances for {@link getFieldDisplayValue}, keyed by canonical
 * locale.
 * @type {Map<LocaleCode | undefined, Intl.NumberFormat>}
 */
const numberFormatterCache = new Map();

/**
 * Get a field’s display value that matches the given field name (key path).
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FlattenedEntryContent} [args.valueMap] Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath Key path, e.g. `author.name`.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {StringTransformation[]} [args.transformations] String transformations.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {PendingEntry[]} [args.pendingEntries] Entries created from a Relation field of the draft
 * being edited, which a Relation field value can refer to before they are saved.
 * @returns {string} Resolved display value.
 */
export const getFieldDisplayValue = ({
  collectionName,
  fileName,
  valueMap = {},
  keyPath,
  locale,
  transformations,
  isIndexFile = false,
  pendingEntries = undefined,
}) => {
  const fieldConfig = getField({ collectionName, fileName, valueMap, keyPath, isIndexFile });
  let value = valueMap[keyPath];

  // If the field doesn’t exist in `valueMap` and transformations are applied, return empty string
  if (value === undefined && transformations?.length) {
    return '';
  }

  if (fieldConfig?.widget === 'datetime') {
    // If the `date` transformation is provided, do nothing; it should be used instead of the field
    // `format` option, so the keep the original value for `applyTransformations()`
    if (!transformations?.some(({ method }) => method === 'date')) {
      value = getDateTimeFieldDisplayValue({
        locale,
        fieldConfig: /** @type {DateTimeField} */ (fieldConfig),
        currentValue: value,
      });
    }
  }

  if (fieldConfig?.widget === 'relation') {
    value = getReferencedOptionLabel({
      fieldConfig: /** @type {RelationField} */ (fieldConfig),
      valueMap,
      keyPath,
      locale,
      pendingEntries,
    });
  }

  if (fieldConfig?.widget === 'select') {
    value = getOptionLabel({
      fieldConfig: /** @type {SelectField} */ (fieldConfig),
      valueMap,
      keyPath,
    });
  }

  if (fieldConfig?.widget === 'list') {
    const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
    const { types } = /** @type {ListFieldWithTypes} */ (fieldConfig);

    if (fields || types) {
      // Ignore
    } else {
      // Concat values of single field list or simple list
      value = getListFormatter(locale).format(
        getListItemKeys(valueMap, keyPath)
          .map((key) => valueMap[key])
          .filter((val) => typeof val === 'string' && !!val),
      );
    }
  }

  if (fieldConfig?.widget === 'number') {
    const { value_type: valueType = 'int' } = /** @type {NumberField} */ (fieldConfig);

    // An empty field, stored as `null` or an empty string, or missing, is left empty rather than
    // formatted as `0` or `NaN`
    if (
      (valueType === 'int' || valueType === 'float') &&
      value !== null &&
      value !== undefined &&
      value !== ''
    ) {
      const canonicalLocale = getCanonicalLocale(locale);
      let numberFormatter = numberFormatterCache.get(canonicalLocale);

      if (!numberFormatter) {
        numberFormatter = Intl.NumberFormat(canonicalLocale);
        numberFormatterCache.set(canonicalLocale, numberFormatter);
      }

      value = numberFormatter.format(Number(value));
    }
  }

  if (Array.isArray(value)) {
    value = getListFormatter(locale).format(value);
  }

  if (transformations?.length) {
    value = applyTransformations({ fieldConfig, value, transformations, locale });
  }

  // Return an empty string if the value is null or undefined
  return String(value ?? '');
};

/**
 * Get the display value of the first visible field that has a non-empty value.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.valueMap Entry content.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for `getField`.
 * @param {string} args.keyPathPrefix Key path prefix that a candidate must start with, e.g.
 * `authors.0.`.
 * @returns {string} Display value of the first visible field that has a non-empty value. If no such
 * field is found, returns an empty string.
 */
export const getVisibleFieldDisplayValue = ({
  valueMap,
  locale,
  keyPath,
  keyPathPrefix,
  getFieldArgs,
}) => {
  // Find the first visible item key path that has a non-empty value. `title` and `name` are
  // preferred, so they’re tried ahead of the map’s own order.
  const visibleItemKeyPath = [
    `${keyPath}.title`,
    `${keyPath}.name`,
    ...getKeysByPrefix(valueMap, keyPathPrefix),
  ].find((_keyPath) => {
    const value = valueMap[_keyPath];

    if (
      !_keyPath.startsWith(keyPathPrefix) ||
      !(
        (typeof value === 'string' && value.trim()) ||
        (typeof value === 'number' && !Number.isNaN(value))
      )
    ) {
      return false;
    }

    const fieldConfig = getField({ ...getFieldArgs, keyPath: _keyPath });

    return !!fieldConfig && fieldConfig.widget !== 'hidden';
  });

  if (visibleItemKeyPath) {
    return getFieldDisplayValue({ ...getFieldArgs, keyPath: visibleItemKeyPath, locale });
  }

  return '';
};

/**
 * Get an entry’s field value by locale and key.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} args.collectionName Name of a collection that the entry belongs to.
 * @param {FieldKeyPath | string} args.key Field key path or one of other entry metadata property
 * keys: `slug`, `commit_author` and `commit_date`.
 * @param {boolean} [args.resolveRef] Whether to resolve the referenced value if the target field is
 * a relation field.
 * @returns {any} Value. An array of the item values for a multi-value field — a List field, or a
 * Relation, Select or media field with `multiple: true` — or of the subfield values for an Object
 * field or a List field with subfields, which are stored flattened, so nothing lives at the field’s
 * own key path.
 */
export const getPropertyValue = ({ entry, locale, collectionName, key, resolveRef = true }) => {
  const { slug, locales, commitAuthor: { name, login, email } = {}, commitDate } = entry;

  if (key === 'slug') {
    return slug;
  }

  if (key === 'commit_author') {
    return name || login || email;
  }

  if (key === 'commit_date') {
    return commitDate;
  }

  const { content } = locales[locale] ?? {};

  if (content === undefined) {
    return undefined;
  }

  const collection = getCollection(collectionName);

  if (!collection) {
    return undefined;
  }

  const isIndexFile = isCollectionIndexFile(collection, entry);
  const fieldConfig = getField({ collectionName, keyPath: key, isIndexFile });

  // Resolve the displayed value for a relation field
  if (resolveRef && fieldConfig?.widget === 'relation') {
    return getReferencedOptionLabel({
      fieldConfig: /** @type {RelationField} */ (fieldConfig),
      valueMap: content,
      keyPath: key,
      locale,
    });
  }

  // Gather the items of a multi-value field, which are flattened under `key.0`, `key.1` and so on,
  // so a view filter can match any of them
  // @see https://github.com/sveltia/sveltia-cms/issues/997
  if (fieldConfig && (fieldConfig.widget === 'list' || isFieldMultiple(fieldConfig))) {
    const itemKeys = getListItemKeys(content, key);

    if (itemKeys.length) {
      return itemKeys.map((itemKey) => content[itemKey]);
    }
  }

  // Gather the subfield values of an Object field, or a List field with subfields, which are
  // flattened under `key.name`, `key.0.name` and so on, so nothing lives at the field’s own key
  // path unless it’s `null`. A view filter can then tell whether it has a value, or match any of
  // the subfield values
  // @see https://github.com/sveltia/sveltia-cms/issues/1004
  if (
    content[key] === undefined &&
    (fieldConfig?.widget === 'object' || fieldConfig?.widget === 'list')
  ) {
    const subKeys = getKeysByPrefix(content, `${key}.`);

    if (subKeys.length) {
      return subKeys.map((subKey) => content[subKey]);
    }
  }

  return content[key];
};
