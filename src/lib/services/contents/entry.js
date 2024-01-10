import { flatten } from 'flat';
import { getReferencedOptionLabel } from '$lib/components/contents/details/widgets/relation/helper';
import { getOptionLabel } from '$lib/components/contents/details/widgets/select/helper';
import { getAssetByPath } from '$lib/services/assets';
import { getCollection } from '$lib/services/contents';

/**
 * Get a field’s config object that matches the given field name (key path).
 * @param {object} args - Arguments.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name if the collection is a file collection.
 * @param {FlattenedEntryContent} [args.valueMap] - Object holding current entry values. This is
 * required when working with list widget variable types.
 * @param {string} args.keyPath - Key path, e.g. `author.name`.
 * @returns {Field} Field configuration.
 */
export const getFieldConfig = ({
  collectionName,
  fileName = undefined,
  valueMap = {},
  keyPath,
}) => {
  const collection = getCollection(collectionName);
  const collectionFile = fileName ? collection._fileMap[fileName] : undefined;
  const { fields } = collectionFile ?? collection;
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
 * @param {object} args - Arguments.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name.
 * @param {FlattenedEntryContent} args.valueMap - Object holding current entry values.
 * @param {string} args.keyPath - Key path, e.g. `author.name`.
 * @param {LocaleCode} args.locale - Locale.
 * @returns {any | any[]} Resolved field value(s).
 */
export const getFieldDisplayValue = ({ collectionName, fileName, valueMap, keyPath, locale }) => {
  const fieldConfig = getFieldConfig({ collectionName, fileName, valueMap, keyPath });
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
 * @param {Entry} entry - Entry.
 * @param {LocaleCode} locale - Locale code.
 * @param {string} key - Field name, which can be dot notation like `name.en` for a nested field, or
 * one of other entry metadata property keys: `slug`, `commit_author` and `commit_date` .
 * @param {object} [options] - Options.
 * @param {boolean} [options.resolveRef] - Whether to resolve the referenced value if the target
 * field is a relation field.
 * @returns {any} Value.
 */
export const getPropertyValue = (entry, locale, key, { resolveRef = true } = {}) => {
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

  const valueMap = key.includes('.') ? flatten(content) : content;

  if (resolveRef) {
    const fieldConfig = getFieldConfig({ collectionName: entry.collectionName, keyPath: key });

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
  }

  return valueMap[key];
};

/**
 * Get a list of assets associated with the given entry.
 * @param {Entry} entry - Entry.
 * @param {object} [options] - Options.
 * @param {boolean} [options.relative] - Whether to only collect assets stored at a relative path.
 * @returns {Asset[]} Assets.
 */
export const getAssociatedAssets = (entry, { relative = false } = {}) => {
  const { collectionName, locales } = entry;

  return Object.values(locales)
    .map(({ content }) =>
      Object.entries(content).map(([keyPath, value]) => {
        if (
          typeof value === 'string' &&
          (relative ? !value.match(/^[/@]/) : true) &&
          ['image', 'file'].includes(getFieldConfig({ collectionName, keyPath })?.widget)
        ) {
          const asset = getAssetByPath(value, entry);

          if (asset?.collectionName === collectionName) {
            return asset;
          }
        }

        return undefined;
      }),
    )
    .flat(1)
    .filter((value, index, array) => !!value && array.indexOf(value) === index);
};
