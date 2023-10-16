import { flatten } from 'flat';
import { getReferencedOptionLabel } from '$lib/components/contents/details/widgets/relation/helper';
import { getOptionLabel } from '$lib/components/contents/details/widgets/select/helper';
import { getCollection } from '$lib/services/contents';

/**
 * Get a field’s config object that matches the given field name (key path).
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] File name if the collection is a file collection.
 * @param {FlattenedEntryContent} [args.valueMap] Object holding current entry values. This is
 * required when working with list widget variable types.
 * @param {string} args.keyPath Key path, e.g. `author.name`.
 * @returns {Field} Field configuration.
 */
export const getFieldConfig = ({
  collectionName,
  fileName = undefined,
  valueMap = {},
  keyPath,
}) => {
  const collection = getCollection(collectionName);
  const { fields } = fileName ? collection.files.find(({ name }) => name === fileName) : collection;
  const keyPathArray = keyPath.split('.');
  /**
   * @type {Field}
   */
  let field;

  keyPathArray.forEach((key, index) => {
    if (index === 0) {
      field = fields.find(({ name }) => name === key);
    } else if (field) {
      const isNumericKey = key.match(/^\d+$/);

      const {
        field: subField,
        fields: subFields,
        types,
        typeKey = 'type',
      } = /** @type {ListField} */ (field);

      if (subField) {
        field = subField;
      } else if (subFields && !isNumericKey) {
        field = subFields.find(({ name }) => name === key);
      } else if (types && isNumericKey) {
        field = types.find(
          ({ name }) =>
            name === valueMap[`${keyPathArray.slice(0, index).join('.')}.${key}.${typeKey}`],
        );
      }
    }
  });

  return field;
};

/**
 * Get a field’s display value that matches the given field name (key path).
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] File name.
 * @param {string} args.keyPath Key path, e.g. `author.name`.
 * @param {FlattenedEntryContent} args.valueMap Object holding current entry values.
 * @param {LocaleCode} args.locale Locale.
 * @returns {any | any[]} Resolved field value(s).
 */
export const getFieldDisplayValue = ({ collectionName, fileName, keyPath, valueMap, locale }) => {
  const fieldConfig = getFieldConfig({
    collectionName,
    fileName,
    valueMap,
    keyPath,
  });

  let value = valueMap[keyPath];

  if (fieldConfig?.widget === 'relation') {
    value = getReferencedOptionLabel({
      // eslint-disable-next-line object-shorthand
      fieldConfig: /** @type {RelationField} */ (fieldConfig),
      valueMap,
      keyPath,
      locale,
    });
  }

  if (fieldConfig?.widget === 'select') {
    value = getOptionLabel({
      // eslint-disable-next-line object-shorthand
      fieldConfig: /** @type {SelectField} */ (fieldConfig),
      valueMap,
      keyPath,
    });
  }

  return value ?? '';
};

/**
 * Get an entry’s field value by locale and key.
 * @param {Entry} entry Entry.
 * @param {LocaleCode} locale Locale code.
 * @param {string} key Field name, which can be dot notation like `name.en` for a nested field, or
 * one of other entry metadata property keys: `slug`, `commit_author` and `commit_date` .
 * @returns {any} Value.
 */
export const getPropertyValue = (entry, locale, key) => {
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

  /** @type {EntryContent} */
  const content = locales[locale]?.content;

  if (content === undefined) {
    return undefined;
  }

  const fieldConfig = getFieldConfig({ collectionName: entry.collectionName, keyPath: key });
  const valueMap = key.includes('.') ? flatten(content) : content;

  // Resolve the displayed value for a relation field
  if (fieldConfig?.widget === 'relation') {
    return getReferencedOptionLabel({
      // eslint-disable-next-line object-shorthand
      fieldConfig: /** @type {RelationField} */ (fieldConfig),
      valueMap,
      keyPath: key,
      locale,
    });
  }

  return valueMap[key];
};
