import { getDateTimeParts } from '@sveltia/utils/datetime';
import { escapeRegExp } from '@sveltia/utils/string';
import moment from 'moment';
import { get } from 'svelte/store';
import { getReferencedOptionLabel } from '$lib/components/contents/details/widgets/relation/helper';
import { getOptionLabel } from '$lib/components/contents/details/widgets/select/helper';
import { getAssetByPath } from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { getCollection } from '$lib/services/contents';
import { getListFormatter } from '$lib/services/contents/i18n';
import { fillSlugTemplate } from '$lib/services/contents/slug';

/**
 * @type {Map<string, Field | undefined>}
 */
const fieldConfigCache = new Map();

/**
 * Get a field’s config object that matches the given field name (key path).
 * @param {object} args - Arguments.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name if the collection is a file collection.
 * @param {FlattenedEntryContent} [args.valueMap] - Object holding current entry values. This is
 * required when working with list/object widget variable types.
 * @param {FieldKeyPath} args.keyPath - Key path, e.g. `author.name`.
 * @returns {Field | undefined} Field configuration.
 */
export const getFieldConfig = ({
  collectionName,
  fileName = undefined,
  valueMap = {},
  keyPath,
}) => {
  const cacheKey = JSON.stringify({ collectionName, fileName, valueMap, keyPath });
  const cache = fieldConfigCache.get(cacheKey);

  if (cache) {
    return cache;
  }

  const collection = getCollection(collectionName);

  if (!collection) {
    fieldConfigCache.set(cacheKey, undefined);

    return undefined;
  }

  const collectionFile = fileName ? collection._fileMap?.[fileName] : undefined;
  const { fields = [] } = collectionFile ?? collection;
  const keyPathArray = keyPath.split('.');
  /**
   * @type {Field | undefined}
   */
  let field;

  keyPathArray.forEach((key, index) => {
    if (index === 0) {
      field = fields.find(({ name }) => name === key);
    } else if (field) {
      const isNumericKey = key.match(/^\d+$/);
      const keyPathArraySub = keyPathArray.slice(0, index);

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
        // List widget variable types
        field = types.find(
          ({ name }) => name === valueMap[[...keyPathArraySub, key, typeKey].join('.')],
        );
      } else if (types && key !== typeKey) {
        // Object widget variable types
        field = types
          .find(({ name }) => name === valueMap[[...keyPathArraySub, typeKey].join('.')])
          ?.fields?.find(({ name }) => name === key);
      }
    }
  });

  fieldConfigCache.set(cacheKey, field);

  return field;
};

/**
 * Get a field’s display value that matches the given field name (key path).
 * @param {object} args - Arguments.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name.
 * @param {FlattenedEntryContent} args.valueMap - Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath - Key path, e.g. `author.name`.
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

  if (fieldConfig?.widget === 'list') {
    const { fields, types } = /** @type {ListField} */ (fieldConfig);

    if (fields || types) {
      // Ignore
    } else {
      // Concat values of single field list or simple list
      value = getListFormatter(locale).format(
        Object.entries(valueMap)
          .filter(
            ([key, val]) =>
              key.match(`^${escapeRegExp(keyPath)}\\.\\d+$`) && typeof val === 'string' && !!val,
          )
          .map(([, val]) => val),
      );
    }
  }

  return value ?? '';
};

/**
 * Get an entry’s field value by locale and key.
 * @param {Entry} entry - Entry.
 * @param {LocaleCode} locale - Locale code.
 * @param {FieldKeyPath | string} key - Field key path or one of other entry metadata property keys:
 * `slug`, `commit_author` and `commit_date`.
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

  const { content } = locales[locale] ?? {};

  if (content === undefined) {
    return undefined;
  }

  if (resolveRef) {
    const fieldConfig = getFieldConfig({ collectionName: entry.collectionName, keyPath: key });

    // Resolve the displayed value for a relation field
    if (fieldConfig?.widget === 'relation') {
      return getReferencedOptionLabel({
        // eslint-disable-next-line object-shorthand
        fieldConfig: /** @type {RelationField} */ (fieldConfig),
        valueMap: content,
        keyPath: key,
        locale,
      });
    }
  }

  return content[key];
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

  return /** @type {Asset[]} */ (
    Object.values(locales)
      .map(({ content }) =>
        Object.entries(content).map(([keyPath, value]) => {
          if (
            typeof value === 'string' &&
            (relative ? !value.match(/^[/@]/) : true) &&
            ['image', 'file'].includes(
              getFieldConfig({ collectionName, keyPath })?.widget ?? 'string',
            )
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
      .filter((value, index, array) => !!value && array.indexOf(value) === index)
  );
};

/**
 * Get the given entry file’s web-accessible URL on the live site.
 * @param {Entry} entry - Entry.
 * @param {LocaleCode} locale - Locale.
 * @param {Collection} collection - Collection.
 * @param {CollectionFile} [collectionFile] - Collection file. File collection only.
 * @returns {string | undefined} URL on the live site.
 */
export const getEntryPreviewURL = (entry, locale, collection, collectionFile) => {
  const { show_preview_links: showLinks = true, site_url: baseURL } = get(siteConfig) ?? {};
  const { slug, path: entryFilePath, content } = entry.locales[locale] ?? {};

  const {
    preview_path: pathTemplate,
    preview_path_date_field: dateFieldName,
    fields,
  } = collectionFile ?? collection;

  if (!showLinks || !baseURL || !entryFilePath || !content || !pathTemplate) {
    return undefined;
  }

  /** @type {Record<string, string> | undefined} */
  let dateTimeParts;

  if (pathTemplate.match(/{{(?:year|month|day|hour|minute|second)}}/g)) {
    const fieldConfig = dateFieldName
      ? fields?.find(({ widget, name }) => widget === 'datetime' && name === dateFieldName)
      : fields?.find(({ widget }) => widget === 'datetime');

    const fieldValue = fieldConfig ? content[fieldConfig.name] : undefined;

    if (!fieldConfig || !fieldValue) {
      return undefined;
    }

    const { format, picker_utc: pickerUTC = false } = /** @type {DateTimeField} */ (fieldConfig);

    dateTimeParts = getDateTimeParts({
      date: (pickerUTC ? moment.utc : moment)(fieldValue, format).toDate(),
      timeZone: pickerUTC ? 'UTC' : undefined,
    });
  }

  try {
    const path = fillSlugTemplate(pathTemplate, {
      type: 'preview_path',
      collection,
      content,
      locale,
      currentSlug: slug,
      entryFilePath,
      dateTimeParts,
    });

    return `${baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  } catch {
    return undefined;
  }
};

/**
 * Get the given entry file’s web-accessible URL on the repository.
 * @param {Entry} entry - Entry.
 * @param {LocaleCode} locale - Locale.
 * @returns {string} URL on the repository.
 */
export const getEntryRepoBlobURL = (entry, locale) =>
  `${get(backend)?.repository?.blobBaseURL}/${entry.locales[locale]?.path}?plain=1`;
