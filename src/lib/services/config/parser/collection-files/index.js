import { getPathInfo } from '@sveltia/utils/file';

import { isFormatMismatch } from '$lib/services/config/parser/collections/format';
import { parseFields } from '$lib/services/config/parser/fields';
import { addMessage, checkDuplicateNames } from '$lib/services/config/parser/utils/messages';

/**
 * @import { CollectionFile, FileCollection, SiteConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Parse and validate a single collection file configuration.
 * @param {object} context Context.
 * @param {SiteConfig} context.siteConfig Raw site configuration.
 * @param {FileCollection} context.collection Collection config to parse.
 * @param {CollectionFile} context.collectionFile File config to parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseCollectionFile = (context, collectors) => {
  const { collection, collectionFile } = context;
  const { file, format = collection.format, fields } = collectionFile;
  const { extension } = getPathInfo(file);

  if (isFormatMismatch(extension, format)) {
    addMessage({
      strKey: 'file_format_mismatch',
      context,
      values: { extension, format },
      collectors,
    });
  }

  parseFields(fields, context, collectors);
};

/**
 * Parse and validate multiple collection file configurations.
 * @param {object} context Context.
 * @param {SiteConfig} context.siteConfig Raw site configuration.
 * @param {FileCollection} context.collection Collection config to parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseCollectionFiles = (context, collectors) => {
  const { siteConfig, collection } = context;
  const { files } = collection;
  /** @type {Record<string, number>} */
  const nameCounts = {};

  files.forEach((collectionFile) => {
    nameCounts[collectionFile.name] = (nameCounts[collectionFile.name] ?? 0) + 1;
    parseCollectionFile({ siteConfig, collection, collectionFile }, collectors);
  });

  checkDuplicateNames({
    nameCounts,
    strKey: 'duplicate_collection_file_name',
    context,
    collectors,
  });
};
