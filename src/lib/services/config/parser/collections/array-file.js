import { getPathInfo } from '@sveltia/utils/file';

import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import { addMessage } from '$lib/services/config/parser/utils/validator';
import { hasLocalePlaceholder } from '$lib/services/contents/i18n/placeholder';
import { getPublishMode } from '$lib/services/workflow/config';

/**
 * @import { CmsConfig, EntryCollection, GitHubBackend } from '$lib/types/public';
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Entry collection options that assume one file per entry, which a collection storing all the
 * entries in one file can’t have.
 * @type {string[]}
 */
const UNSUPPORTED_OPTIONS = [
  'extension',
  'path',
  'slug',
  'slug_length',
  'nested',
  'meta',
  'index_file',
  'reorder',
];

/**
 * Check if the given template contains the `{{slug}}` tag. In a collection storing all the entries
 * in one file, the slug of an entry is its position in the array, which changes when the entries
 * are reordered or one is deleted, so it can’t identify the entry outside the CMS.
 * @param {string} template Template, e.g. `/members/{{slug}}`.
 * @returns {boolean} Result.
 */
export const hasSlugTag = (template) =>
  // A tag can come with transformations, e.g. `{{slug | upper}}`
  [...template.matchAll(TEMPLATE_TAG_REPLACE_REGEX)].some(
    ([, tag]) => tag.split('|')[0].trim() === 'slug',
  );

/**
 * Validate an entry collection storing all the entries in one file, defined with the `file` option.
 * The file must be a JSON file, which holds the entries as an array of objects.
 * @param {object} context Context.
 * @param {CmsConfig} context.cmsConfig Raw CMS configuration.
 * @param {EntryCollection} context.collection Collection config to parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const checkArrayFileOptions = (context, collectors) => {
  const { cmsConfig, collection } = context;
  const { file, format, preview_path: previewPath, thumbnail } = collection;

  // The type of the `file` option is checked against the JSON schema
  if (typeof file !== 'string') {
    return;
  }

  // A translation is stored in each object, so the file can’t be localized
  if (getPathInfo(file).extension !== 'json' || hasLocalePlaceholder(file)) {
    addMessage({ strKey: 'invalid_collection_data_file', values: { file }, context, collectors });
  }

  if (format !== undefined && format !== 'json') {
    addMessage({
      strKey: 'file_format_mismatch',
      values: { extension: 'json', format },
      context,
      collectors,
    });
  }

  UNSUPPORTED_OPTIONS.forEach((prop) => {
    if (prop in collection) {
      addMessage({
        strKey: 'unsupported_collection_data_file_option',
        values: { prop },
        context,
        collectors,
      });
    }
  });

  // A preview URL or a thumbnail file path made from the position would point to another entry once
  // the entries have been reordered. A value of the wrong type is reported against the JSON schema
  /** @type {[string, unknown][]} */ ([
    ['preview_path', previewPath],
    // A thumbnail path starts with a slash, while a field key path can’t contain the tag
    ...(Array.isArray(thumbnail) ? thumbnail : [thumbnail]).map((path) => ['thumbnail', path]),
  ]).forEach(([prop, template]) => {
    if (typeof template === 'string' && hasSlugTag(template)) {
      addMessage({
        strKey: 'collection_data_file_slug_tag',
        values: { prop },
        context,
        collectors,
      });
    }
  });

  // Editorial Workflow saves each entry on a branch of its own, so two entries would be two pull
  // requests changing the same file, and merging or deleting one could remove the other entries.
  // An Open Authoring contributor always goes through the workflow
  if (
    getPublishMode({ cmsConfig, collection }) === 'editorial_workflow' ||
    /** @type {GitHubBackend | undefined} */ (cmsConfig.backend)?.open_authoring
  ) {
    addMessage({ strKey: 'collection_data_file_workflow', context, collectors });
  }
};
