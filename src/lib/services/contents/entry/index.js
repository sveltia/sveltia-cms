import { getDateTimeParts } from '@sveltia/utils/datetime';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsUTC from 'dayjs/plugin/utc';
import { get } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { fillTemplate } from '$lib/services/common/template';
import { cmsConfig } from '$lib/services/config';
import { getEntryFoldersByPath } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import {
  getIndexFile,
  isCollectionIndexFile,
} from '$lib/services/contents/collection/entries/index-file';
import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';
import { getDate, isValidDate } from '$lib/services/contents/fields/date-time/helpers';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { DateTimeField, Field } from '$lib/types/public';
 */

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsLocalizedFormat);
dayjs.extend(dayjsUTC);

/**
 * Regular expression to match date and time template placeholders in entry file path templates.
 */
const DATE_TIME_TEMPLATE_REGEX = /{{(?:year|month|day|hour|minute|second)}}/;

/**
 * Get a list of collections the given entry belongs to. One entry can theoretically appear in
 * multiple collections depending on the configuration, so that the result is an array.
 * @param {Entry} entry Entry.
 * @returns {InternalCollection[]} Collections.
 */
export const getAssociatedCollections = (entry) =>
  getEntryFoldersByPath(Object.values(entry.locales)[0].path)
    .map(({ collectionName }) => getCollection(collectionName))
    .filter((collection) => !!collection);

/**
 * Determine date and time parts from the given entry content.
 * @param {object} args Arguments.
 * @param {string} [args.dateFieldName] Date field name.
 * @param {Field[]} args.fields Fields.
 * @param {FlattenedEntryContent} args.content Entry content.
 * @returns {Record<string, string> | undefined} Date and time parts.
 */
export const extractDateTime = ({ dateFieldName, fields, content }) => {
  const fieldConfig = dateFieldName
    ? fields.find(({ widget, name }) => widget === 'datetime' && name === dateFieldName)
    : fields.find(({ widget }) => widget === 'datetime');

  const fieldValue = fieldConfig ? content[fieldConfig.name] : undefined;

  if (!fieldConfig || !fieldValue) {
    return undefined;
  }

  const config = /** @type {DateTimeField} */ (fieldConfig);
  const date = getDate(fieldValue, config);

  if (!isValidDate(date)) {
    return undefined;
  }

  const { utc, outputUTC } = parseDateTimeConfig(config);
  const timeZone = utc || outputUTC ? 'UTC' : undefined;

  return getDateTimeParts({ date, timeZone });
};

/**
 * Get the given entry’s path on the live site, based on the `preview_path` option defined on the
 * collection or collection file. The result is not normalized, so it may or may not have a leading
 * slash, depending on the template.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {string} [args.slug] Entry slug for the locale.
 * @param {string} [args.path] Entry file path for the locale.
 * @param {FlattenedEntryContent} [args.content] Entry content for the locale.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @returns {string | undefined} Path on the live site, or `undefined` if it cannot be determined,
 * typically because the `preview_path` option is not defined.
 */
export const getPreviewPath = ({
  collection,
  collectionFile,
  locale,
  slug,
  path: entryFilePath,
  content,
  isIndexFile = false,
}) => {
  const {
    preview_path: pathTemplate,
    preview_path_date_field: dateFieldName,
    fields: regularFields = [],
    _i18n: { defaultLocale, omitDefaultLocaleFromPreviewPath },
  } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  if (!entryFilePath || !content || !pathTemplate) {
    return undefined;
  }

  const indexFile = isIndexFile ? getIndexFile(collection) : undefined;
  const fields = indexFile?.fields ?? regularFields;
  /** @type {Record<string, string> | undefined} */
  let dateTimeParts;

  if (DATE_TIME_TEMPLATE_REGEX.test(pathTemplate)) {
    dateTimeParts = extractDateTime({ dateFieldName, fields, content });

    // Cannot generate a URL if the date and time parts are not available
    if (!dateTimeParts) {
      return undefined;
    }
  }

  let template = pathTemplate;

  // Handle the case where the default locale is omitted from the preview path, ensuring that the
  // URL is correctly generated without the locale segment for the default locale.
  if (locale === defaultLocale && omitDefaultLocaleFromPreviewPath) {
    template = template.replace(/{{locale}}[./]/, '');
  }

  try {
    return fillTemplate(template, {
      type: 'preview_path',
      collection,
      content,
      locale,
      currentSlug: slug,
      entryFilePath,
      dateTimeParts,
      isIndexFile,
    });
  } catch {
    return undefined;
  }
};

/**
 * Get the given entry file’s web-accessible URL on the live site or a deploy preview.
 * @param {Entry} entry Entry.
 * @param {InternalLocaleCode} locale Locale.
 * @param {InternalCollection} collection Collection.
 * @param {InternalCollectionFile} [collectionFile] Collection file. File/singleton collection only.
 * @param {object} [options] Options.
 * @param {string} [options.baseURL] Base URL to use instead of the site’s own, typically the deploy
 * preview URL reported by a CI/CD provider for an Editorial Workflow pull request. It takes
 * precedence over the `site_url` option, which may be unset.
 * @returns {string | undefined} URL on the live site or the deploy preview.
 * @see https://decapcms.org/docs/deploy-preview-links/
 */
export const getEntryPreviewURL = (entry, locale, collection, collectionFile, options = {}) => {
  const { show_preview_links: showLinks = true, _baseURL } = get(cmsConfig) ?? {};
  const baseURL = options.baseURL || _baseURL;
  const { slug, path, content } = entry.locales[locale] ?? {};

  if (!showLinks || !baseURL) {
    return undefined;
  }

  const previewPath = getPreviewPath({
    collection,
    collectionFile,
    locale,
    slug,
    path,
    content,
    isIndexFile: isCollectionIndexFile(collection, entry),
  });

  if (previewPath === undefined) {
    return undefined;
  }

  return `${baseURL.replace(/\/$/, '')}/${previewPath.replace(/^\//, '')}`;
};

/**
 * Get the given entry file’s web-accessible URL on the repository.
 * @param {Entry} entry Entry.
 * @param {InternalLocaleCode} locale Locale.
 * @returns {string} URL on the repository.
 */
export const getEntryRepoBlobURL = (entry, locale) =>
  `${get(backend)?.repository?.blobBaseURL}/${entry.locales[locale]?.path}?plain=1`;
