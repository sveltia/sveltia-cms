import { customFileFormatRegistry } from '$lib/services/api/registries';
import { BUILTIN_FILE_FORMATS } from '$lib/services/contents/file/constants';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import { FileFormatter, FileParser } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

/**
 * Register a custom entry file format. A custom format with the same name as a built-in one, such
 * as `json`, takes precedence over it, and registering a format again replaces the previous one.
 * @param {string} name Format name. This should match the `format` option of a collection where the
 * custom format will be used.
 * @param {string} extension File extension without a leading dot, e.g. `json5`. Files in a
 * collection with the custom format use this extension, regardless of the collection’s `extension`
 * option.
 * @param {{ fromFile?: FileParser, toFile?: FileFormatter }} methods Parser and/or formatter
 * methods. Async functions can be used. Without `fromFile`, files in the format are parsed with the
 * built-in parser for the format name, if any; without `toFile`, they are formatted likewise. If
 * the format name isn’t a built-in one, such as `yaml` or `json`, omit neither: without `fromFile`,
 * files in the format can’t be loaded, and without `toFile`, saving an entry fails with an error,
 * leaving the file untouched. A warning is logged when either is missing.
 * @throws {TypeError} If `name` or `extension` is not a non-empty string, or if `fromFile` or
 * `toFile` is given but not a function.
 * @throws {Error} If neither `fromFile` nor `toFile` is provided.
 * @see https://decapcms.org/docs/custom-formatters/
 * @see https://sveltiacms.app/en/docs/api/file-formats
 */
const registerCustomFormat = (name, extension, { fromFile, toFile } = {}) => {
  if (!isNonEmptyString(name)) {
    throw new TypeError(
      'The `name` option for `CMS.registerCustomFormat()` must be a non-empty string',
    );
  }

  if (!isNonEmptyString(extension)) {
    throw new TypeError(
      'The `extension` option for `CMS.registerCustomFormat()` must be a non-empty string',
    );
  }

  // Check the types first, so a method given by mistake as a non-function is reported as such
  // rather than as a missing method
  if (typeof fromFile !== 'undefined' && typeof fromFile !== 'function') {
    throw new TypeError(
      'The `fromFile` option for `CMS.registerCustomFormat()` must be a function',
    );
  }

  if (typeof toFile !== 'undefined' && typeof toFile !== 'function') {
    throw new TypeError('The `toFile` option for `CMS.registerCustomFormat()` must be a function');
  }

  if (typeof fromFile !== 'function' && typeof toFile !== 'function') {
    throw new Error(
      'At least one of `fromFile` or `toFile` must be provided to `CMS.registerCustomFormat()`',
    );
  }

  // Without a built-in method to fall back to, the format can only go one way
  if (!BUILTIN_FILE_FORMATS.includes(name)) {
    if (!fromFile) {
      // eslint-disable-next-line no-console
      console.warn(
        `The custom “${name}” format has no \`fromFile\` method, so its entries can’t be loaded`,
      );
    }

    if (!toFile) {
      // eslint-disable-next-line no-console
      console.warn(
        `The custom “${name}” format has no \`toFile\` method, so its entries can’t be saved`,
      );
    }
  }

  customFileFormatRegistry.set(name, { extension, parser: fromFile, formatter: toFile });
};

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `register-custom-format.d.ts` file
export { registerCustomFormat };
