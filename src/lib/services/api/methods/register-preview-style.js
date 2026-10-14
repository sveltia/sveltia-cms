import { customPreviewStyleRegistry } from '$lib/services/api/registries';
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
  if (!isNonEmptyString(style)) {
    throw new TypeError(
      'The `style` option for `CMS.registerPreviewStyle()` must be a non-empty string',
    );
  }

  if (typeof raw !== 'boolean') {
    throw new TypeError('The `raw` option for `CMS.registerPreviewStyle()` must be a boolean');
  }

  if (collection !== undefined && !isNonEmptyString(collection)) {
    throw new TypeError(
      'The `collection` option for `CMS.registerPreviewStyle()` must be a non-empty string',
    );
  }

  if (file !== undefined && !isNonEmptyString(file)) {
    throw new TypeError(
      'The `file` option for `CMS.registerPreviewStyle()` must be a non-empty string',
    );
  }

  if (file !== undefined && collection === undefined) {
    throw new TypeError(
      'The `file` option for `CMS.registerPreviewStyle()` requires the `collection` option',
    );
  }

  const base = window.location.href;

  if (!raw && !URL.canParse(style, base)) {
    throw new TypeError(
      'The `style` option for `CMS.registerPreviewStyle()` must be a valid URL or file path ' +
        'when `raw` is false',
    );
  }

  const url = raw
    ? // Create a blob URL for the raw CSS string
      URL.createObjectURL(new Blob([style], { type: 'text/css' }))
    : // Convert relative URLs to absolute to ensure they work in the preview iframe, which has a
      // unique blob URL as its origin
      new URL(style, base).href;

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
