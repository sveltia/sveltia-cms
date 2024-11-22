import { getDateTimeParts } from '@sveltia/utils/datetime';
import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import { sanitize } from 'isomorphic-dompurify';
import { parseInline } from 'marked';
import moment from 'moment';
import { parseEntities } from 'parse-entities';
import { get } from 'svelte/store';
import { getReferencedOptionLabel } from '$lib/components/contents/details/widgets/relation/helper';
import { getOptionLabel } from '$lib/components/contents/details/widgets/select/helper';
import {
  allAssets,
  getAssetByPath,
  getCollectionsByAsset,
  getMediaFieldURL,
} from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { getCollection } from '$lib/services/contents';
import { getListFormatter } from '$lib/services/contents/i18n';
import { applyTransformations, fillSlugTemplate } from '$lib/services/contents/slug';

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

  const collectionFile = fileName
    ? /** @type {FileCollection} */ (collection)?._fileMap[fileName]
    : undefined;

  if (!collection || (fileName && !collectionFile)) {
    fieldConfigCache.set(cacheKey, undefined);

    return undefined;
  }

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
        const subFieldName = isNumericKey ? keyPathArray[index + 1] : undefined;

        // It’s possible to get a single-subfield List field with or without a subfield name (e.g.
        // `image.0` or `image.0.src`), but when a subfield name is specified, check if it’s valid
        field = !subFieldName || subField.name === subFieldName ? subField : undefined;
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
 * @param {string[]} [args.transformations] - String transformations.
 * @returns {any | any[]} Resolved field value(s).
 */
export const getFieldDisplayValue = ({
  collectionName,
  fileName,
  valueMap,
  keyPath,
  locale,
  transformations,
}) => {
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

  if (Array.isArray(value)) {
    value = getListFormatter(locale).format(value);
  }

  if (transformations?.length) {
    value = applyTransformations({ fieldConfig, value, transformations });
  }

  return value ? String(value) : '';
};

/**
 * Get an entry’s field value by locale and key.
 * @param {object} args - Arguments.
 * @param {Entry} args.entry - Entry.
 * @param {LocaleCode} args.locale - Locale code.
 * @param {string} args.collectionName - Name of a collection that the entry belongs to.
 * @param {FieldKeyPath | string} args.key - Field key path or one of other entry metadata property
 * keys: `slug`, `commit_author` and `commit_date`.
 * @param {boolean} [args.resolveRef] - Whether to resolve the referenced value if the target
 * field is a relation field.
 * @returns {any} Value.
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

  if (resolveRef) {
    const fieldConfig = getFieldConfig({ collectionName, keyPath: key });

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
 * Parse the given entry title as Markdown and sanitize HTML with a few exceptions if the Markdown
 * option is enabled. Also, parse HTML character references (entities).
 * @param {string} str - Original string.
 * @param {object} [options] - Options.
 * @param {boolean} [options.allowMarkdown] - Whether to allow Markdown and return HTML string.
 * @returns {string} Parsed string.
 */
const sanitizeEntryTitle = (str, { allowMarkdown = false } = {}) => {
  str = /** @type {string} */ (parseInline(str));
  str = sanitize(str, { ALLOWED_TAGS: allowMarkdown ? ['strong', 'em', 'code'] : [] });
  str = parseEntities(str);

  return str.trim();
};

/**
 * Determine an entry title from the given content. Fields other than `title` should be defined with
 * the `identifier_field` collection option as per the Netlify/Decap CMS document. We also look for
 * the `name` and `label` properties as well as a header in the Markdown `body` as a fallback.
 * @param {FlattenedEntryContent | RawEntryContent} content - Content.
 * @param {object} options - Options.
 * @param {string} [options.identifierField] - Field name to identify the title.
 * @param {boolean} [options.useBody] - Whether to fall back to a header in the Markdown `body`.
 * @returns {string} Entry title. Can be an empty string if it cannot be determined.
 * @see https://decapcms.org/docs/configuration-options/#identifier_field
 */
export const getEntryTitleFromContent = (
  content,
  { identifierField = 'title', useBody = true } = {},
) => {
  const idField = [identifierField, 'title', 'name', 'label'].find(
    (fieldName) => typeof content[fieldName] === 'string' && !!content[fieldName].trim(),
  );

  if (idField) {
    return content[idField].trim();
  }

  // Find a header in Markdown, excluding an anchor suffix
  // https://vitepress.dev/guide/markdown#custom-anchors
  if (useBody && typeof content.body === 'string') {
    return content.body.match(/^#+\s+(.+?)(?:\s+\{#.+?\})?\s*$/m)?.[1] ?? '';
  }

  return '';
};

/**
 * Get the given entry’s title that can be displayed in the entry list and other places. Format it
 * with the summary template if necessary, or simply use the `title` or similar field in the entry.
 * @param {Collection} collection - Entry’s collection.
 * @param {Entry} entry - Entry.
 * @param {object} [options] - Options.
 * @param {LocaleCode} [options.locale] - Target locale. The default locale is used if omitted.
 * @param {boolean} [options.useTemplate] - Whether to use the collection’s `summary` template if
 * available.
 * @param {boolean} [options.allowMarkdown] - Whether to allow Markdown and return HTML string.
 * @returns {string} Formatted entry title.
 * @see https://decapcms.org/docs/configuration-options/#summary
 */
export const getEntryTitle = (
  collection,
  entry,
  { locale, useTemplate = false, allowMarkdown = false } = {},
) => {
  const {
    name: collectionName,
    folder,
    identifier_field: identifierField = 'title',
    summary: summaryTemplate,
    _i18n: { defaultLocale },
  } = collection;

  const basePath = folder ? /** @type {EntryCollection} */ (collection)._file.basePath : undefined;
  const { locales, slug, commitDate, commitAuthor } = entry;

  const { content = {}, path: entryPath = '' } =
    locales[locale ?? defaultLocale] ?? Object.values(locales)[0] ?? {};

  if (!useTemplate || !summaryTemplate) {
    return sanitizeEntryTitle(getEntryTitleFromContent(content, { identifierField }) || slug, {
      allowMarkdown,
    });
  }

  /**
   * Replacer subroutine.
   * @param {string} tag - Field name or one of special tags.
   * @returns {any} Summary.
   */
  const replaceSub = (tag) => {
    if (tag === 'slug') {
      return slug;
    }

    if (tag === 'dirname') {
      return stripSlashes(entryPath.replace(/[^/]+$/, '').replace(basePath ?? '', ''));
    }

    if (tag === 'filename') {
      return /** @type {string} */ (entryPath.split('/').pop()).split('.').shift();
    }

    if (tag === 'extension') {
      return /** @type {string} */ (entryPath.split('/').pop()).split('.').pop();
    }

    if (tag === 'commit_date') {
      return commitDate ?? '';
    }

    if (tag === 'commit_author') {
      return commitAuthor?.name || commitAuthor?.login || commitAuthor?.email;
    }

    return undefined;
  };

  /**
   * Replacer.
   * @param {string} placeholder - Field name or one of special tags. May contain transformations.
   * @returns {string} Replaced string.
   */
  const replace = (placeholder) => {
    const [tag, ...transformations] = placeholder.split(/\s*\|\s*/);
    const valueMap = content;
    const keyPath = tag.replace(/^fields\./, '');
    /** @type {any} */
    let value = replaceSub(tag);

    if (value === undefined) {
      value = getFieldDisplayValue({ collectionName, valueMap, keyPath, locale: defaultLocale });
    }

    if (value === undefined) {
      return '';
    }

    if (value instanceof Date && !transformations.length) {
      const { year, month, day } = getDateTimeParts({ date: value });

      return `${year}-${month}-${day}`;
    }

    if (transformations.length) {
      value = applyTransformations({
        fieldConfig: getFieldConfig({ collectionName, valueMap, keyPath }),
        value,
        transformations,
      });
    }

    return String(value);
  };

  return sanitizeEntryTitle(
    summaryTemplate.replace(/{{(.+?)}}/g, (_match, placeholder) => replace(placeholder)),
    { allowMarkdown },
  );
};

/**
 * Get the given entry’s thumbnail URL.
 * @param {EntryCollection} collection - Entry’s collection.
 * @param {Entry} entry - Entry.
 * @returns {Promise<string | undefined>} URL.
 */
export const getEntryThumbnail = async (collection, entry) => {
  const {
    _i18n: { defaultLocale },
    _thumbnailFieldName,
  } = collection;

  const { locales } = entry;
  const { content } = locales[defaultLocale] ?? Object.values(locales)[0] ?? {};

  if (content && _thumbnailFieldName) {
    return getMediaFieldURL(content[_thumbnailFieldName], entry, { thumbnail: true });
  }

  return undefined;
};

/**
 * Get a list of assets associated with the given entry.
 * @param {object} args - Arguments.
 * @param {Entry} args.entry - Entry.
 * @param {string} args.collectionName - Name of a collection that the entry belongs to.
 * @param {boolean} [args.relative] - Whether to only collect assets stored at a relative path.
 * @returns {Asset[]} Assets.
 */
export const getAssociatedAssets = ({ entry, collectionName, relative = false }) => {
  const { locales } = entry;
  const collection = getCollection(collectionName);

  const assets = /** @type {Asset[]} */ (
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
            const asset = getAssetByPath(value, { entry, collection });

            if (asset && getCollectionsByAsset(asset).some((c) => c.name === collectionName)) {
              return asset;
            }
          }

          return undefined;
        }),
      )
      .flat(1)
      .filter((value, index, array) => !!value && array.indexOf(value) === index)
  );

  // Add orphaned/unused entry-relative assets
  if (relative && collection?._assetFolder?.entryRelative) {
    const entryDirName = getPathInfo(Object.values(entry.locales)[0].path).dirname;

    get(allAssets).forEach((asset) => {
      if (
        getPathInfo(asset.path).dirname === entryDirName &&
        !assets.find(({ path }) => path === asset.path)
      ) {
        assets.push(asset);
      }
    });
  }

  return assets;
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

    const { format, picker_utc: utc = false } = /** @type {DateTimeField} */ (fieldConfig);

    dateTimeParts = getDateTimeParts({
      date: (utc ? moment.utc : moment)(fieldValue, format).toDate(),
      timeZone: utc ? 'UTC' : undefined,
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
