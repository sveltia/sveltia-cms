import { getPathInfo } from '@sveltia/utils/file';

import { isFormatMismatch } from '$lib/services/config/parser/collections/format';
import { parseFields } from '$lib/services/config/parser/fields';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';

/**
 * @import { CmsConfig, CollectionFile, FileCollection } from '$lib/types/public';
 * @import { ConfigParserCollectors, InternalSingletonCollection } from '$lib/types/private';
 */

/**
 * Parse and validate a single collection file configuration.
 * @param {object} context Context.
 * @param {CmsConfig} context.cmsConfig Raw CMS configuration.
 * @param {FileCollection | InternalSingletonCollection} context.collection Collection config to
 * parse.
 * @param {CollectionFile} context.collectionFile File config to parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseCollectionFile = (context, collectors) => {
  const { collection, collectionFile } = context;
  // @ts-ignore singleton files don’t have `format` property on their files
  const { file, format = collection.format, fields } = collectionFile;
  const { extension } = getPathInfo(file);

  if (isFormatMismatch(extension, format, fields)) {
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
 * @param {CmsConfig} context.cmsConfig Raw CMS configuration.
 * @param {FileCollection | InternalSingletonCollection} context.collection Collection config to
 * parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseCollectionFiles = (context, collectors) => {
  const { cmsConfig, collection } = context;
  const { files } = collection;
  const checkNameArgs = { nameCounts: {}, strKeyBase: 'collection_file_name', collectors };

  files.forEach((collectionFile, index) => {
    // Skip file dividers
    if ('divider' in collectionFile) return;

    const { name } = collectionFile;
    const newContext = { cmsConfig, collection, collectionFile };

    if (checkName({ ...checkNameArgs, name, index, context: newContext })) {
      parseCollectionFile(newContext, collectors);
    }
  });
};
