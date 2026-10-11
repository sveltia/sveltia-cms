/* eslint-disable camelcase */

import { _ } from '@sveltia/i18n';

import {
  DATE_TIME_FIELDS,
  TEMPLATE_TAG_REPLACE_REGEX,
  UUID_TYPES,
} from '$lib/services/common/template/constants';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';
import { CLOUD_MEDIA_LIBRARY_NAMES } from '$lib/services/integrations/media-libraries/cloud';

/**
 * @import { CmsConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 */

/**
 * Options that set an asset folder path.
 */
const FOLDER_OPTIONS = ['media_folder', 'public_folder'];

/**
 * Template tags that the `media_folder` and `public_folder` options of a collection, a collection
 * file or a field can use, which may be followed by transformations: the slug template tags and the
 * entry file path parts. Any other tag, such as a field name, resolves to a random ID that changes
 * with every entry draft.
 * @type {string[]}
 */
const FOLDER_TEMPLATE_TAGS = [
  ...DATE_TIME_FIELDS,
  ...Object.keys(UUID_TYPES),
  'slug',
  'dirname',
  'filename',
  'extension',
];

/**
 * Template tags standing for the global `media_folder` and `public_folder` options. They are
 * replaced as they are, so they can’t have spaces or transformations.
 * @type {string[]}
 */
const GLOBAL_FOLDER_TAGS = ['{{media_folder}}', '{{public_folder}}'];

/**
 * Check the template tags in the `media_folder` and `public_folder` options. The global options
 * can’t have any, as there is no entry to fill them in with, so they would be used literally.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.config Configuration holding the options: the site
 * configuration, a collection, a collection file or a field.
 * @param {boolean} [args.isGlobal] Whether the configuration is the site configuration.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkFolderTemplateTags = ({ config, isGlobal = false, context, collectors }) => {
  FOLDER_OPTIONS.forEach((option) => {
    const folder = config[option];

    // A value of another type is reported against the JSON schema
    if (typeof folder !== 'string') {
      return;
    }

    [...folder.matchAll(TEMPLATE_TAG_REPLACE_REGEX)].forEach(([tag, inner]) => {
      // A transformation follows the tag name after a pipe
      const name = inner.split('|')[0].trim();

      if (!isGlobal && (GLOBAL_FOLDER_TAGS.includes(tag) || FOLDER_TEMPLATE_TAGS.includes(name))) {
        return;
      }

      addMessage({
        strKey: isGlobal ? 'global_folder_template_tag' : 'unsupported_folder_template_tag',
        values: { option, tag },
        context,
        collectors,
      });
    });
  });
};

/**
 * Check whether a cloud media library is configured, in which case an internal media folder is not
 * needed.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @returns {boolean} Result.
 */
const hasCloudMediaLibrary = ({ media_library, media_libraries }) =>
  CLOUD_MEDIA_LIBRARY_NAMES.includes(/** @type {any} */ (media_library?.name ?? '')) ||
  Object.keys(media_libraries ?? {}).some((name) =>
    CLOUD_MEDIA_LIBRARY_NAMES.includes(/** @type {any} */ (name)),
  );

/**
 * Parse and validate media folder configuration. The type of each option is checked against the
 * JSON schema, so only the rules the schema can’t express are verified here.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the media folder config.
 */
export const parseMediaConfig = (cmsConfig, collectors) => {
  const { media_folder, public_folder, asset_collections } = cmsConfig;
  const { errors, warnings } = collectors;

  if (media_folder === undefined && !hasCloudMediaLibrary(cmsConfig)) {
    errors.add(_('config.error.missing_media_folder'));
  }

  // An empty site-level public folder is treated like an unset one, so the media folder path is
  // used instead of storing bare file names as Netlify/Decap CMS does. Let the user know
  if (public_folder === '' && media_folder !== undefined) {
    warnings.add(_('config.warning.empty_public_folder'));
  }

  if (typeof public_folder === 'string') {
    if (/^\.{1,2}\//.test(public_folder)) {
      errors.add(_('config.error.public_folder_relative_path'));
    }

    if (/^https?:/.test(public_folder)) {
      errors.add(_('config.error.public_folder_absolute_url'));
    }
  }

  checkFolderTemplateTags({
    config: cmsConfig,
    isGlobal: true,
    context: { cmsConfig },
    collectors,
  });

  if (Array.isArray(asset_collections)) {
    const checkNameArgs = { nameCounts: {}, strKeyBase: 'asset_collection_name', collectors };

    asset_collections.forEach((assetCollection, index) => {
      const { name } = assetCollection;

      checkName({ ...checkNameArgs, name, index, context: { cmsConfig } });
      // An asset collection has no entry to fill in template tags with either
      checkFolderTemplateTags({
        config: assetCollection,
        isGlobal: true,
        context: { cmsConfig },
        collectors,
      });
    });
  }
};
