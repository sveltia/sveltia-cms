import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { splitTransformations } from '$lib/services/common/transformations';

/**
 * Normalize the template tags in a string to their canonical form, without spaces after the opening
 * curly braces or before the closing ones, and with a single space on either side of each pipe
 * separating transformations, e.g. `{{ title|upper }}` becomes `{{title | upper}}`. Spaces in a
 * quoted transformation argument are kept, and so is an escaped tag, e.g. `\{{ title }}`, along
 * with its backslash. This lets the code that looks for a specific tag, like `{{slug}}` or
 * `{{locale}}`, compare the template as is.
 * @param {string} str String that may contain template tags.
 * @returns {string} Normalized string.
 */
export const normalizeTemplateTags = (str) =>
  str.includes('{{')
    ? replaceTemplateTags(
        str,
        (_match, placeholder) => `{{${splitTransformations(placeholder).join(' | ')}}}`,
        { unescape: false },
      )
    : str;
