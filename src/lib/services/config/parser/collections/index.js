/* eslint-disable camelcase */

import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { parseCollectionFiles } from '$lib/services/config/parser/collection-files';
import { isFormatMismatch } from '$lib/services/config/parser/collections/format';
import { parseFields } from '$lib/services/config/parser/fields';

/**
 * @import { CollectionFile, EntryCollection, FileCollection, SiteConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Parse and validate a single entry collection configuration.
 * @internal
 * @param {object} context Context.
 * @param {SiteConfig} context.siteConfig Raw site configuration.
 * @param {EntryCollection} context.collection Collection config to parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseEntryCollection = ({ siteConfig, collection }, collectors) => {
  const { name, label, extension, format, fields, index_file } = collection;
  const { errors } = collectors;

  if (isFormatMismatch(extension, format)) {
    errors.add(
      get(_)('config.error.collection_format_mismatch', {
        values: {
          collection: label ?? name,
          extension,
          format,
        },
      }),
    );
  }

  parseFields(fields, { siteConfig, collection }, collectors);

  if (index_file) {
    parseFields(
      index_file === true ? fields : (index_file.fields ?? fields),
      { siteConfig, collection, isIndexFile: true },
      collectors,
    );
  }
};

/**
 * Parse and validate a single file collection configuration.
 * @internal
 * @param {object} context Context.
 * @param {SiteConfig} context.siteConfig Raw site configuration.
 * @param {FileCollection} context.collection Collection config to parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseFileCollection = ({ siteConfig, collection }, collectors) => {
  parseCollectionFiles({ siteConfig, collection }, collectors);
};

/**
 * Parse and validate the collections configuration from the site config.
 * @param {SiteConfig} siteConfig Raw site configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the collections config.
 */
export const parseCollections = (siteConfig, collectors) => {
  const { collections, singletons } = siteConfig;
  const { errors, warnings } = collectors;

  if (!Array.isArray(collections) && !Array.isArray(singletons)) {
    errors.add(get(_)('config.error.no_collection'));

    return;
  }

  let hasNestedCollections = false;

  collections?.forEach((collection) => {
    if ('divider' in collection) {
      // Skip dividers
    } else if ('files' in collection) {
      parseFileCollection({ siteConfig, collection }, collectors);
    } else {
      parseEntryCollection({ siteConfig, collection }, collectors);

      if (collection.nested) {
        hasNestedCollections = true;
      }
    }
  });

  if (hasNestedCollections) {
    warnings.add(get(_)('config.warning.nested_collections_unsupported'));
  }

  const files = /** @type {CollectionFile[]} */ (
    singletons?.filter((c) => !('divider' in c)) || []
  );

  if (files.length) {
    parseFileCollection({ siteConfig, collection: { name: '_singletons', files } }, collectors);
  }
};
