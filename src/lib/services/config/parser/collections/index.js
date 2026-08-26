/* eslint-disable camelcase */

import { _ } from '@sveltia/i18n';
import { isObject } from '@sveltia/utils/object';

import { warnDeprecation } from '$lib/services/config/deprecations';
import { parseCollectionFiles } from '$lib/services/config/parser/collection-files';
import { isFormatMismatch } from '$lib/services/config/parser/collections/format';
import { checkPreviewPath } from '$lib/services/config/parser/collections/preview';
import { checkViewOptions } from '$lib/services/config/parser/collections/views';
import { parseFields } from '$lib/services/config/parser/fields';
import {
  addMessage,
  checkName,
  checkUnsupportedOptions,
} from '$lib/services/config/parser/utils/validator';
import { parseViewOptions } from '$lib/services/contents/collection/view/utils';

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
  // @todo Remove this warning when Sveltia CMS adds support for nested collections.
  { type: 'warning', prop: 'nested', strKey: 'nested_collections_unsupported' },
  // Deprecated camelCase option in Netlify/Decap CMS config, should be converted to snake_case.
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

  const {
    extension,
    format,
    fields,
    index_file,
    preview_path,
    preview_path_date_field,
    reorder,
    slug,
    slug_length: legacySlugLength,
    view_groups,
  } = collection;

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

  if (!fields?.length) {
    addMessage({ strKey: 'collection_no_fields', context, collectors });
  }

  parseFields(fields, context, collectors);

  if (index_file) {
    parseFields(
      index_file === true ? fields : (index_file.fields ?? fields),
      { cmsConfig, collection, isIndexFile: true },
      collectors,
    );
  }

  // Validate the group named with the `reorder` option: an unknown name would silently fall back to
  // an ungrouped list in reorder mode, which is hard to tell from a working configuration. The raw
  // option is read here rather than through `getReorderGroupName()`, which lives in the runtime
  // module graph (stores, backends) this parser runs before. `parseViewOptions()` is what
  // `parseGroupConfig()` calls, so group lookup can’t diverge from the runtime.
  const reorderGroupName = isObject(reorder) ? reorder.group : undefined;

  if (typeof reorderGroupName === 'string' && reorderGroupName) {
    const { options } = parseViewOptions(view_groups, 'groups');

    if (!options.some(({ name }) => name === reorderGroupName)) {
      addMessage({
        strKey: 'invalid_reorder_group',
        values: { name: reorderGroupName },
        context,
        collectors,
      });
    }
  }

  // Validate the `preview_path` option against the fields that can fill in its date and time tags.
  // An index file can define its own fields, and the preview path reads from those for that entry,
  // so a date field defined only there still counts
  checkPreviewPath({
    pathTemplate: preview_path,
    dateFieldName: preview_path_date_field,
    fields: [...(fields ?? []), ...(isObject(index_file) ? (index_file.fields ?? []) : [])],
    context,
    collectors,
  });

  // Validate the `sortable_fields`, `view_groups` and `view_filters` options, including the fields
  // they refer to and the view group and filter names
  checkViewOptions(context, collectors);

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

  if (!Array.isArray(collections) && !Array.isArray(singletons)) {
    errors.add(_('config.error.no_collection'));

    return;
  }

  // Validate that at least one collection is visible in the sidebar. A config where every
  // collection is hidden with the `hide` option — or where the list contains nothing but dividers —
  // leaves the user with an empty UI, which looks like a broken CMS rather than a configuration
  // mistake. Singletons are always visible, so they satisfy the requirement on their own.
  const hasVisibleCollection =
    !!collections?.some((collection) => !('divider' in collection) && !collection.hide) ||
    !!singletons?.length;

  if (!hasVisibleCollection) {
    errors.add(_('config.error.no_visible_collection'));
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
      label: _('singletons'),
      label_singular: _('singleton'),
      files: singletons,
    };

    parseCollectionFiles({ cmsConfig, collection }, collectors);
  }
};
