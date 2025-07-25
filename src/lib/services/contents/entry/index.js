import { getDateTimeParts } from '@sveltia/utils/datetime';
import moment from 'moment';
import { get } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { fillTemplate } from '$lib/services/common/template';
import { siteConfig } from '$lib/services/config';
import { getEntryFoldersByPath } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getIndexFile, isCollectionIndexFile } from '$lib/services/contents/collection/index-file';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { DateTimeField, Field } from '$lib/types/public';
 */

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

  const { format, picker_utc: utc = false } = /** @type {DateTimeField} */ (fieldConfig);

  return getDateTimeParts({
    date: (utc ? moment.utc : moment)(fieldValue, format).toDate(),
    timeZone: utc ? 'UTC' : undefined,
  });
};

/**
 * Get the given entry file’s web-accessible URL on the live site.
 * @param {Entry} entry Entry.
 * @param {InternalLocaleCode} locale Locale.
 * @param {InternalCollection} collection Collection.
 * @param {InternalCollectionFile} [collectionFile] Collection file. File/singleton collection only.
 * @returns {string | undefined} URL on the live site.
 * @see https://decapcms.org/docs/deploy-preview-links/
 */
export const getEntryPreviewURL = (entry, locale, collection, collectionFile) => {
  const { show_preview_links: showLinks = true, _baseURL: baseURL } = get(siteConfig) ?? {};
  const { slug, path: entryFilePath, content } = entry.locales[locale] ?? {};

  const {
    preview_path: pathTemplate,
    preview_path_date_field: dateFieldName,
    fields: regularFields = [],
  } = collectionFile ?? collection;

  if (!showLinks || !baseURL || !entryFilePath || !content || !pathTemplate) {
    return undefined;
  }

  const isIndexFile = isCollectionIndexFile(collection, entry);
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

  try {
    const path = fillTemplate(pathTemplate, {
      type: 'preview_path',
      collection,
      content,
      locale,
      currentSlug: slug,
      entryFilePath,
      dateTimeParts,
      isIndexFile,
    });

    return `${baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  } catch {
    return undefined;
  }
};

/**
 * Get the given entry file’s web-accessible URL on the repository.
 * @param {Entry} entry Entry.
 * @param {InternalLocaleCode} locale Locale.
 * @returns {string} URL on the repository.
 */
export const getEntryRepoBlobURL = (entry, locale) =>
  `${get(backend)?.repository?.blobBaseURL}/${entry.locales[locale]?.path}?plain=1`;
