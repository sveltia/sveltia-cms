import { escapeAttr } from '$lib/services/utils/string';

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
