import { getDateTimeParts } from '@sveltia/utils/datetime';
import { getPathInfo } from '@sveltia/utils/file';

import { formatFileName } from '$lib/services/assets/file-name';
import { replaceTemplatePlaceholder } from '$lib/services/common/template/replacers';
import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { cmsConfig } from '$lib/services/config';

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
 * Create a template to name an uploaded file with, capturing the current date and time so the name
 * doesn’t change between the one shown while editing and the one saved.
 * @param {string} template The `filename_template` media library option.
 * @param {object} [options] Options.
 * @param {boolean} [options.slugificationEnabled] Whether the filled name is slugified, according
 * to the `slugify_filename` media library option.
 * @returns {AssetNameTemplate} Template.
 */
export const createAssetNameTemplate = (template, { slugificationEnabled = false } = {}) => {
  const timeZone = cmsConfig.current?.slug?.timezone === 'local' ? undefined : 'UTC';

  return {
    template,
    slugificationEnabled,
    randomValues: new Map(),
    dateTimeParts: getDateTimeParts({ timeZone }),
  };
};

/**
 * Fill the `filename_template` media library option to get the name of an uploaded file. The tag
 * values are slugified like in an entry slug template, and the original extension is appended.
 * @param {object} args Arguments.
 * @param {AssetNameTemplate} args.nameTemplate Template.
 * @param {string} args.originalName Original file name, which `{{filename}}` and `{{extension}}`
 * stand for.
 * @param {InternalCollection} [args.collection] Collection of the entry the file is added to.
 * @param {string} [args.collectionFileName] Collection file name. File/singleton collection only.
 * @param {FlattenedEntryContent} [args.content] Content of the entry in the default locale.
 * @param {string} [args.slug] Slug of the entry in the default locale.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s special index file.
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

  const identifierField =
    collection?._type === 'entry' ? (collection.identifier_field ?? 'title') : 'title';

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
 * applies to the file. The template is filled with the default locale’s slug and content, so a file
 * used in several locales gets one name, which is then sanitized, and slugified if the
 * `slugify_filename` option is enabled, like an upload in the asset library.
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

  const { collection, fileName, defaultLocale, currentValues, isIndexFile } = draft;

  const name = fillAssetNameTemplate({
    nameTemplate,
    originalName: file.name,
    collection,
    collectionFileName: fileName,
    content: currentValues[defaultLocale],
    slug: defaultLocaleSlug,
    isIndexFile,
  });

  return formatFileName(name, { slugificationEnabled: nameTemplate.slugificationEnabled });
};
