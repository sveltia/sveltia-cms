import { isObject } from '@sveltia/utils/object';

import { addMessage } from '$lib/services/config/parser/utils/validator';
import { RASTER_IMAGE_FORMATS, VECTOR_IMAGE_FORMATS } from '$lib/services/utils/media/image';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 */

/**
 * Keys accepted by the `transformations` option. `raster_image` matches any supported raster image
 * format, while the other keys match a specific source format.
 * @type {string[]}
 */
const TRANSFORMATION_KEYS = ['raster_image', ...RASTER_IMAGE_FORMATS, ...VECTOR_IMAGE_FORMATS];

/**
 * Parse and validate raster image transformation options.
 * @param {object} args Arguments.
 * @param {string} args.key Transformation key, such as `raster_image` or `jpeg`.
 * @param {Record<string, any>} args.options Transformation options.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const parseRasterImageTransformation = ({ key, options, context, collectors }) => {
  const { quality } = options;
  const args = { values: { key }, context, collectors };

  if (quality !== undefined && !(Number.isSafeInteger(quality) && quality >= 0 && quality <= 100)) {
    addMessage({ ...args, strKey: 'invalid_transformation_quality' });
  }

  ['width', 'height'].forEach((prop) => {
    const value = options[prop];

    if (value !== undefined && !(Number.isSafeInteger(value) && value > 0)) {
      addMessage({ ...args, strKey: 'invalid_transformation_size', values: { key, prop } });
    }
  });
};

/**
 * Parse and validate the `transformations` option of the default media library. The options are
 * applied to files being uploaded, so any problem must be reported here rather than silently
 * ignored at upload time. Option types are checked against the JSON schema; what’s left is the
 * numeric ranges and the set of accepted keys, neither of which the schema can express.
 * @param {object} args Arguments.
 * @param {any} args.transformations File transformation option map.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const parseTransformations = ({ transformations, context, collectors }) => {
  if (!isObject(transformations)) {
    return;
  }

  Object.entries(transformations).forEach(([key, options]) => {
    // Unknown keys are silently ignored at upload time, and the schema allows them because unknown
    // options are tolerated everywhere else
    if (!TRANSFORMATION_KEYS.includes(key)) {
      addMessage({ strKey: 'invalid_transformation_key', values: { key }, context, collectors });

      return;
    }

    // Vector images only take an `optimize` flag, whose type the schema checks
    if (!isObject(options) || /** @type {string[]} */ (VECTOR_IMAGE_FORMATS).includes(key)) {
      return;
    }

    parseRasterImageTransformation({
      key,
      options: /** @type {Record<string, any>} */ (options),
      context,
      collectors,
    });
  });
};

/**
 * Parse and validate the default media library options defined in the given site or field
 * configuration. Options for the other libraries are passed to their own SDK or API client, so they
 * are not validated here.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.config Site or field configuration.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const parseMediaLibraries = ({ config, context, collectors }) => {
  const { media_library: mediaLibrary, media_libraries: mediaLibraries } = config;
  /** @type {any[]} */
  const configs = [];

  if (isObject(mediaLibraries)) {
    // The `all` options are shared defaults for the default library
    configs.push(mediaLibraries.all);

    if (isObject(mediaLibraries.default)) {
      configs.push(mediaLibraries.default.config);
    }
  }

  // The legacy `media_library` option supports one library only, defaulting to the internal one
  if (isObject(mediaLibrary) && (mediaLibrary.name ?? 'default') === 'default') {
    configs.push(mediaLibrary.config);
  }

  configs.forEach((libraryConfig) => {
    if (isObject(libraryConfig)) {
      parseTransformations({ transformations: libraryConfig.transformations, context, collectors });
    }
  });
};
