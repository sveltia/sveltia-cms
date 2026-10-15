import { customPreviewStyleRegistry } from '$lib/services/api/registries';
import { assertOption, assertValid, parseURLFromPage } from '$lib/services/api/validate';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * Register a custom stylesheet to be applied to the entry preview pane. Multiple stylesheets can
 * be registered. A stylesheet can be limited to the entries of a collection, or to a file in a
 * file/singleton collection.
 * @param {string} style URL or file path of a stylesheet, or a raw CSS string if the `raw` option
 * is `true`. A relative path is resolved against the current page URL.
 * @param {object} [options] Options.
 * @param {boolean} [options.raw] Whether `style` is a raw CSS string. Default: `false`.
 * @param {string} [options.collection] Name of the collection whose entries the stylesheet is
 * applied to. Use `_singletons` for the singleton collection. Default: all collections.
 * @param {string} [options.file] Name of the file in the file/singleton collection given with the
 * `collection` option that the stylesheet is applied to. Default: all files in the collection.
 * @throws {TypeError} If `style` is not a non-empty string, `raw` is not a boolean, `style` is not
 * a valid URL or file path when `raw` is `false`, `collection` or `file` is given but not a
 * non-empty string, or `file` is given without `collection`.
 * @see https://decapcms.org/docs/customization/#registerpreviewstyle
 * @see https://sveltiacms.app/en/docs/api/preview-styles
 */
const registerPreviewStyle = (style, { raw = false, collection, file } = {}) => {
  assertOption(isNonEmptyString(style), 'registerPreviewStyle', 'style', 'a non-empty string');
  assertOption(typeof raw === 'boolean', 'registerPreviewStyle', 'raw', 'a boolean');

  assertOption(
    collection === undefined || isNonEmptyString(collection),
    'registerPreviewStyle',
    'collection',
    'a non-empty string',
  );

  assertOption(
    file === undefined || isNonEmptyString(file),
    'registerPreviewStyle',
    'file',
    'a non-empty string',
  );

  assertValid(
    file === undefined || collection !== undefined,
    'The `file` option for `CMS.registerPreviewStyle()` requires the `collection` option',
  );

  // Convert a relative URL to absolute to ensure it works in the preview iframe, which has a
  // unique blob URL as its origin
  const parsedURL = raw ? null : parseURLFromPage(style);

  assertOption(
    raw || !!parsedURL,
    'registerPreviewStyle',
    'style',
    'a valid URL or file path when `raw` is false',
  );

  const url = raw
    ? // Create a blob URL for the raw CSS string
      URL.createObjectURL(new Blob([style], { type: 'text/css' }))
    : /** @type {URL} */ (parsedURL).href;

  const registered = [...customPreviewStyleRegistry].some(
    (entry) => entry.url === url && entry.collection === collection && entry.file === file,
  );

  if (!registered) {
    customPreviewStyleRegistry.add({ url, collection, file });
  }
};

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `register-preview-style.d.ts` file
export { registerPreviewStyle };
