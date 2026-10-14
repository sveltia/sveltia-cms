import { customPreviewTemplateRegistry } from '$lib/services/api/registries';
import { getPreviewStyleURLs } from '$lib/services/contents/editor/preview-styles';
import { escapeAttr } from '$lib/services/utils/string';

/**
 * @import { CustomPreviewTemplate } from '$lib/types/public';
 */

/**
 * Get the custom preview template registered for an entry.
 * @param {object} args Arguments.
 * @param {string} [args.collectionName] Collection name, or `_singletons` for a singleton file.
 * @param {string} [args.fileName] File name in a file/singleton collection.
 * @returns {CustomPreviewTemplate | undefined} Template, if any.
 */
export const getPreviewTemplate = ({ collectionName, fileName }) =>
  customPreviewTemplateRegistry.get(/** @type {string} */ (fileName ?? collectionName));

/**
 * Check if the preview of an entry is rendered in an iframe, which is the case when a custom
 * preview stylesheet or template applies to it.
 * @param {object} args Arguments.
 * @param {string} [args.collectionName] Collection name, or `_singletons` for a singleton file.
 * @param {string} [args.fileName] File name in a file/singleton collection.
 * @returns {boolean} Result.
 */
export const usesPreviewFrame = ({ collectionName, fileName }) =>
  !!getPreviewTemplate({ collectionName, fileName }) ||
  getPreviewStyleURLs({ collectionName, fileName }).length > 0;

/**
 * Build the HTML document loaded into the iframe of a preview that uses custom preview styles or a
 * custom preview template.
 * @param {object} args Arguments.
 * @param {string} [args.lang] Language of the document, if any.
 * @param {'ltr' | 'rtl' | 'auto'} [args.dir] Text direction of the document, if any.
 * @param {string[]} args.styleURLs Custom stylesheet URLs to apply.
 * @param {string} args.origin Origin of the CMS, used as the base URL of the document.
 * @returns {string} HTML string.
 */
export const buildPreviewFrameHTML = ({ lang, dir, styleURLs, origin }) => `
    <!DOCTYPE html>
    <html${lang ? ` lang="${escapeAttr(lang)}"` : ''}${dir ? ` dir="${dir}"` : ''}>
    <head>
      <meta charset="UTF-8">
      <base href="${escapeAttr(origin)}" target="_blank">
      ${styleURLs.map((url) => `<link rel="stylesheet" href="${escapeAttr(url)}">`).join('\n')}
    </head>
    <body></body>
    </html>
  `;
