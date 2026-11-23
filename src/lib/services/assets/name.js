import { getDateTimeParts } from '@sveltia/utils/datetime';
import { getPathInfo } from '@sveltia/utils/file';

import { formatFileName } from '$lib/services/assets/file-name';
import { getSlugTimeZone } from '$lib/services/common/slug';
import { replaceTemplatePlaceholder } from '$lib/services/common/template/replacers';
import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { getIdentifierFieldName } from '$lib/services/contents/collection/identifier';

/**
 * @import { ReplaceContext } from '$lib/services/common/template/replacers';
 * @import {
 * AssetNameTemplate,
 * EntryDraft,
 * EntryFileItem,
 * FlattenedEntryContent,
 * InternalCollection,
 * } from '$lib/types/private';
 */

/**
 * Entry values a `filename_template` is filled with.
 * @typedef {object} AssetNameContext
 * @property {InternalCollection} [collection] Collection of the entry the file is added to.
 * @property {string} [collectionFileName] Collection file name. File/singleton collection only.
 * @property {FlattenedEntryContent} [content] Content of the entry in the default locale.
 * @property {string} [slug] Slug of the entry in the default locale.
 * @property {boolean} [isIndexFile] Whether the entry is the collection’s special index file.
 */

/**
 * Create a template to name an uploaded file with, capturing the current date and time so the name
 * doesn’t change between the one shown while editing and the one saved.
 * @param {string} template The `filename_template` media library option.
 * @param {object} [options] Options.
 * @param {boolean} [options.slugificationEnabled] Whether the filled name is slugified, according
 * to the `slugify_filename` media library option.
 * @returns {AssetNameTemplate} Template.
 */
export const createAssetNameTemplate = (template, { slugificationEnabled = false } = {}) => ({
  template,
  slugificationEnabled,
  randomValues: new Map(),
  dateTimeParts: getDateTimeParts({ timeZone: getSlugTimeZone() }),
});

/**
 * Get the entry values a `filename_template` is filled with. They come from the default locale, so
 * a file used in several locales gets one name.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @returns {AssetNameContext} Context.
 */
export const getAssetNameContext = ({ draft, defaultLocaleSlug }) => {
  const { collection, fileName, defaultLocale, currentValues, isIndexFile } = draft;

  return {
    collection,
    collectionFileName: fileName,
    content: currentValues[defaultLocale],
    slug: defaultLocaleSlug,
    isIndexFile,
  };
};

/**
 * Fill the `filename_template` media library option to get the name of an uploaded file. The tag
 * values are slugified like in an entry slug template, and the original extension is appended.
 * @param {AssetNameContext & { nameTemplate: AssetNameTemplate, originalName: string }} args
 * Arguments: the template, the original file name, which `{{filename}}` and `{{extension}}` stand
 * for, and the entry values.
 * @returns {string} File name.
 */
export const fillAssetNameTemplate = ({
  nameTemplate: { template, randomValues, dateTimeParts },
  originalName,
  collection,
  collectionFileName,
  content = {},
  slug,
  isIndexFile = false,
}) => {
  const { extension } = getPathInfo(originalName);

  const identifierField = getIdentifierFieldName(
    collection?._type === 'entry' ? collection : undefined,
  );

  /** @type {ReplaceContext} */
  const context = {
    replaceSubContext: {
      collection: /** @type {InternalCollection} */ (collection),
      content,
      currentSlug: slug,
      dateTimeParts,
      randomValues,
      assetFileName: originalName,
      identifierField,
      basePath: undefined,
    },
    getFieldArgs: {
      collectionName: collection?.name ?? '',
      fileName: collectionFileName,
      keyPath: '',
      valueMap: content,
      isIndexFile,
    },
  };

  const name = replaceTemplateTags(template, (_match, tag) =>
    replaceTemplatePlaceholder(tag, context),
  ).trim();

  return extension ? `${name}.${extension}` : name;
};

/**
 * Get the name a file pending upload in an entry draft is saved with, before it’s made unique in
 * the target folder. It’s the file’s own name unless the `filename_template` media library option
 * applies to the file. The filled name is then sanitized, and slugified if the `slugify_filename`
 * option is enabled, like an upload in the asset library.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {EntryFileItem} args.item File pending upload.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @returns {string} File name.
 */
export const getPendingFileName = ({ draft, item: { file, nameTemplate }, defaultLocaleSlug }) => {
  if (!nameTemplate) {
    return file.name;
  }

  const name = fillAssetNameTemplate({
    nameTemplate,
    originalName: file.name,
    ...getAssetNameContext({ draft, defaultLocaleSlug }),
  });

  return formatFileName(name, { slugificationEnabled: nameTemplate.slugificationEnabled });
};
