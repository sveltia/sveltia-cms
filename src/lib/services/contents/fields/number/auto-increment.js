import { getMaxEntryNumber } from '$lib/services/contents/draft/save/sort-order';
import { getField } from '$lib/services/contents/entry/fields';
import { isPerEntryField } from '$lib/services/contents/entry/per-entry';
import { isValueEmpty } from '$lib/services/utils/object';

/**
 * @import { EntryDraft, InternalCollection } from '$lib/types/private';
 * @import { Field, FieldKeyPath, NumberField } from '$lib/types/public';
 */

/**
 * Check whether a field is a Number field whose value is assigned automatically on save, like an
 * `AUTO_INCREMENT` column in a relational database. Such a field is read-only and isn’t validated.
 * The option only applies to a field holding one value per entry of an entry collection; it’s
 * ignored elsewhere, e.g. in a List field.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s special index file.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {boolean} [args.inEditorComponent] Whether the field is in a rich text editor component.
 * @returns {boolean} Result.
 * @see https://github.com/decaporg/decap-cms/issues/2367
 */
export const isAutoIncrementField = ({ fieldConfig, ...args }) =>
  fieldConfig.widget === 'number' &&
  /** @type {NumberField} */ (fieldConfig).auto_increment === true &&
  isPerEntryField(args);

/**
 * Get the number to assign to an auto-increment Number field: the integer after the highest one
 * any entry of the collection has, or the field’s `min` option, if it’s higher, so the numbering
 * can start from e.g. `1000`. Without either, the numbering starts from `1`.
 * @param {object} args Arguments.
 * @param {NumberField} args.fieldConfig Field configuration.
 * @param {InternalCollection} args.collection Entry collection.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {number} args.offset Number of entries already given a number that aren’t in the
 * collection yet.
 * @returns {number | string} Number, as a string if the field’s `value_type` is a string type.
 */
const getNextNumber = ({ fieldConfig, collection, keyPath, offset }) => {
  const { value_type: valueType = 'int', min } = fieldConfig;

  const max = Math.floor(
    getMaxEntryNumber({
      collectionName: collection.name,
      keyPath,
      locale: collection._i18n.defaultLocale,
    }),
  );

  const start = typeof min === 'number' && Number.isFinite(min) ? Math.ceil(min) : 1;
  const next = Math.max(max + 1, start) + offset;

  return valueType.endsWith('/string') ? String(next) : next;
};

/**
 * Assign the next number to the auto-increment Number fields in the draft’s current values, at
 * save time rather than when the draft is created, so two entries created at the same time can’t
 * take the same number, as with the `reorder` collection option. A new entry always gets a number,
 * even if it was duplicated from another entry, while an existing entry gets one only if it had
 * none in the default locale when it was opened, such as an entry saved before the option was
 * enabled. That’s decided by the original value rather than the current one, so a save that failed
 * after numbering the entry doesn’t keep a number another entry may have taken since. Every locale
 * holding the field gets the same number.
 * @param {EntryDraft} draft Draft to mutate in place.
 * @param {number} [offset] Number of entries already given a number that aren’t in the collection
 * yet, such as the entries added from a Relation field that are saved along with the entry being
 * edited. Each of them takes the next number, so this entry comes after them.
 */
export const assignAutoIncrementValues = (draft, offset = 0) => {
  const { isNew, collection, collectionName, isIndexFile, currentValues, originalValues } = draft;

  // The option only applies to an entry collection, so don’t look up any field elsewhere
  if (collection._type !== 'entry' || isIndexFile) {
    return;
  }

  const { defaultLocale } = collection._i18n;
  const defaultValueMap = currentValues[defaultLocale] ?? {};

  Object.keys(defaultValueMap).forEach((keyPath) => {
    const fieldConfig = getField({
      collectionName,
      keyPath,
      valueMap: defaultValueMap,
      isIndexFile,
    });

    if (
      !fieldConfig ||
      !isAutoIncrementField({ fieldConfig, collection, isIndexFile, keyPath }) ||
      !(isNew || isValueEmpty(originalValues[defaultLocale]?.[keyPath]))
    ) {
      return;
    }

    const value = getNextNumber({
      fieldConfig: /** @type {NumberField} */ (fieldConfig),
      collection,
      keyPath,
      offset,
    });

    Object.values(currentValues).forEach((valueMap) => {
      if (keyPath in valueMap) {
        valueMap[keyPath] = value;
      }
    });
  });
};
