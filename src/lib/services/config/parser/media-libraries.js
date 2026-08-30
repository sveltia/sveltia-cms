import { isObject } from '@sveltia/utils/object';

import { addMessage } from '$lib/services/config/parser/utils/validator';
import {
  RASTER_IMAGE_CONVERSION_FORMATS,
  RASTER_IMAGE_FORMATS,
  VECTOR_IMAGE_FORMATS,
} from '$lib/services/utils/media/image';

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
  const { format, quality } = options;
  const args = { values: { key }, context, collectors };

  if (
    format !== undefined &&
    !(/** @type {string[]} */ (RASTER_IMAGE_CONVERSION_FORMATS).includes(format))
  ) {
    addMessage({ ...args, strKey: 'invalid_transformation_format', schemaCovered: true });
  }

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
 * Parse and validate vector image transformation options.
 * @param {object} args Arguments.
 * @param {string} args.key Transformation key, which is always `svg`.
 * @param {Record<string, any>} args.options Transformation options.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const parseVectorImageTransformation = ({ key, options, context, collectors }) => {
  const { optimize } = options;

  if (optimize !== undefined && typeof optimize !== 'boolean') {
    addMessage({
      strKey: 'invalid_transformation_optimize',
      values: { key },
      context,
      collectors,
      schemaCovered: true,
    });
  }
};

/**
 * Parse and validate the `transformations` option of the default media library. The options are
 * applied to files being uploaded, so any problem must be reported here rather than silently
 * ignored at upload time. The options whose type the JSON schema checks are marked as such, so
 * they’re only reported here when the schema couldn’t be applied.
 * @param {object} args Arguments.
 * @param {any} args.transformations File transformation option map.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const parseTransformations = ({ transformations, context, collectors }) => {
  if (transformations === undefined) {
    return;
  }

  if (!isObject(transformations)) {
    addMessage({ strKey: 'invalid_transformations', context, collectors, schemaCovered: true });

    return;
  }

  Object.entries(transformations).forEach(([key, options]) => {
    // Unknown keys are silently ignored at upload time, and the schema allows them because unknown
    // options are tolerated everywhere else
    if (!TRANSFORMATION_KEYS.includes(key)) {
      addMessage({ strKey: 'invalid_transformation_key', values: { key }, context, collectors });

      return;
    }

    if (!isObject(options)) {
      addMessage({
        strKey: 'invalid_transformation_options',
        values: { key },
        context,
        collectors,
        schemaCovered: true,
      });

      return;
    }

    const args = {
      key,
      options: /** @type {Record<string, any>} */ (options),
      context,
      collectors,
    };

    if (/** @type {string[]} */ (VECTOR_IMAGE_FORMATS).includes(key)) {
      parseVectorImageTransformation(args);
    } else {
      parseRasterImageTransformation(args);
    }
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
