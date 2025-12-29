/* eslint-disable camelcase */

import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { warnDeprecation } from '$lib/services/config/deprecations';
import { parseCollectionFiles } from '$lib/services/config/parser/collection-files';
import { isFormatMismatch } from '$lib/services/config/parser/collections/format';
import { parseFields } from '$lib/services/config/parser/fields';
import {
  addMessage,
  checkName,
  checkUnsupportedOptions,
} from '$lib/services/config/parser/utils/validator';

/**
 * @import { CmsConfig, Collection, CollectionDivider, EntryCollection } from '$lib/types/public';
 * @import {
 * ConfigParserCollectors,
 * InternalSingletonCollection,
 * UnsupportedOption,
 * } from '$lib/types/private';
 */

/**
 * Unsupported options for Number fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  { type: 'warning', prop: 'nested', strKey: 'nested_collections_unsupported' },
  { prop: 'sortableFields', newProp: 'sortable_fields' },
];

/**
 * Parse and validate a single entry collection configuration.
 * @internal
 * @param {object} context Context.
 * @param {CmsConfig} context.cmsConfig Raw CMS configuration.
 * @param {EntryCollection} context.collection Collection config to parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseEntryCollection = (context, collectors) => {
  const { cmsConfig, collection } = context;
  const { extension, format, fields, index_file, slug, slug_length: legacySlugLength } = collection;

  if (isFormatMismatch(extension, format)) {
    addMessage({
      strKey: 'file_format_mismatch',
      values: { extension, format },
      context,
      collectors,
    });
  }

  // @todo Remove the legacy option prior to the 1.0 release.
  if (legacySlugLength !== undefined) {
    warnDeprecation('slug_length');
  }

  checkUnsupportedOptions({ UNSUPPORTED_OPTIONS, config: collection, context, collectors });

  parseFields(fields, context, collectors);

  if (index_file) {
    parseFields(
      index_file === true ? fields : (index_file.fields ?? fields),
      { cmsConfig, collection, isIndexFile: true },
      collectors,
    );
  }

  // Validate slug template: should not contain slashes to avoid confusion with `path` option.
  // @see https://github.com/decaporg/decap-cms/issues/513
  if (slug?.includes('/')) {
    addMessage({
      strKey: 'invalid_slug_slash',
      values: { slug },
      context,
      collectors,
    });
  }
};

/**
 * Parse and validate a collection or divider configuration.
 * @internal
 * @param {object} context Context.
 * @param {CmsConfig} context.cmsConfig Raw CMS configuration.
 * @param {Collection | CollectionDivider} context.collection Collection config to parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseCollection = ({ cmsConfig, collection }, collectors) => {
  const hasDivider = 'divider' in collection;
  const hasFiles = 'files' in collection;
  const hasFolder = 'folder' in collection;

  // Validate at least one option
  if (!hasDivider && !hasFiles && !hasFolder) {
    addMessage({
      strKey: 'invalid_collection_no_options',
      context: { cmsConfig, collection },
      collectors,
    });

    return;
  }

  // Validate mutually exclusive options
  if ((hasDivider && hasFiles) || (hasDivider && hasFolder) || (hasFiles && hasFolder)) {
    addMessage({
      strKey: 'invalid_collection_multiple_options',
      // @ts-ignore
      context: { cmsConfig, collection },
      collectors,
    });

    return;
  }

  if (hasFiles) {
    parseCollectionFiles({ cmsConfig, collection }, collectors);
  } else if (hasFolder) {
    parseEntryCollection({ cmsConfig, collection }, collectors);
  }
};

/**
 * Parse and validate the collections configuration from the site config.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the collections config.
 */
export const parseCollections = (cmsConfig, collectors) => {
  const { collections, singletons } = cmsConfig;
  const { errors } = collectors;
  const $_ = get(_);

  if (!Array.isArray(collections) && !Array.isArray(singletons)) {
    errors.add($_('config.error.no_collection'));

    return;
  }

  const checkNameArgs = { nameCounts: {}, strKeyBase: 'collection_name', collectors };

  collections?.forEach((collection, index) => {
    // Skip collection dividers
    if ('divider' in collection) return;

    const { name } = collection;
    const newContext = { cmsConfig, collection };

    if (checkName({ ...checkNameArgs, name, index, context: newContext })) {
      parseCollection(newContext, collectors);
    }
  });

  if (Array.isArray(singletons)) {
    /** @type {InternalSingletonCollection} */
    const collection = {
      name: '_singletons',
      label: $_('singletons'),
      label_singular: $_('singleton'),
      files: singletons,
    };

    parseCollectionFiles({ cmsConfig, collection }, collectors);
  }
};
