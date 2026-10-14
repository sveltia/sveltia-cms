import { stripTags } from '@sveltia/utils/string';

import { cmsConfig } from '$lib/services/config';

/**
 * @import { MarkdownField, RichTextField } from '$lib/types/public';
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 */

/**
 * Escape every `<` that would start a tag, comment or declaration in Markdown or HTML: one followed
 * by a letter, `/`, `!` or `?`.
 * @param {string} str Original string.
 * @returns {string} Escaped string.
 */
const escapeTagOpenings = (str) => str.replaceAll(/<(?=[!/?a-z])/gi, '&lt;');

/**
 * Sanitize a value given in the URL for a new entry, e.g. `?body=…`, to prevent XSS attacks as the
 * preview may not be sanitized: anyone can craft such a URL. `stripTags()` returns `textContent`,
 * which decodes character references, e.g. `&lt;svg&gt;` becomes `<svg>`, so escape any `<` that
 * would start a tag again. Other ones are left as is, e.g. `a < b` in a code span, where Markdown
 * would show the reference itself.
 * @param {string} value Value given in the URL.
 * @returns {string} Sanitized value.
 */
export const sanitizeDynamicValue = (value) => {
  try {
    return escapeTagOpenings(stripTags(value));
  } catch {
    // Fallback for environments where DOMParser is not available (in Vitest). Use a simple regex
    // to remove HTML tags as a basic sanitization measure
    return escapeTagOpenings(value.replace(/<[^>]*>/g, ''));
  }
};

/**
 * Get the default value map for a RichText/Markdown field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<string, string>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const { default: defaultValue = cmsConfig.current?.field_defaults?.richtext?.default } =
    /** @type {MarkdownField | RichTextField} */ (fieldConfig);

  const value =
    dynamicValue !== undefined ? sanitizeDynamicValue(dynamicValue) : defaultValue || '';

  return { [keyPath]: value };
};
