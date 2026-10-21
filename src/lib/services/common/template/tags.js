import { TAG_PLACEHOLDER, TEMPLATE_TAG_REGEX } from '$lib/services/common/template/constants';

/**
 * Get the closest character before or after the given position that isn’t whitespace.
 * @param {string} str String.
 * @param {number} index Position to start from, excluded.
 * @param {-1 | 1} step `-1` to look backward, `1` to look forward.
 * @returns {string} Character, or an empty string if there is none.
 */
const getAdjacentChar = (str, index, step) => {
  let cursor = index + step;

  while (/\s/.test(str[cursor] ?? '')) {
    cursor += step;
  }

  return str[cursor] ?? '';
};

/**
 * Replace template tags in a string while leaving nested template tags inside transformation
 * arguments untouched. For example, this keeps `default('{{title}}')` from being treated as a
 * separate replacement target when the outer template is processed.
 * @param {string} str The string containing template tags.
 * @param {(match: string, placeholder: string) => string} replacer Replacement callback.
 * @returns {string} Result of the replacements.
 */
export const replaceTemplateTags = (str, replacer) => {
  let result = '';
  let searchIndex = 0;

  while (searchIndex < str.length) {
    const openIndex = str.indexOf('{{', searchIndex);

    if (openIndex === -1) {
      result += str.slice(searchIndex);
      break;
    }

    result += str.slice(searchIndex, openIndex);

    let cursor = openIndex + 2;
    let quoteState = false;

    while (cursor < str.length) {
      const char = str[cursor];
      const nextChar = str[cursor + 1];

      // Like `splitTransformations()`, a quote only opens a transformation argument after `(` or
      // `,`, and only closes it before `,` or `)`, so an apostrophe, as in `default('Don't')`,
      // doesn’t throw off the parsing
      if (char === "'") {
        if (!quoteState && ['(', ','].includes(getAdjacentChar(str, cursor, -1))) {
          quoteState = true;
        } else if (quoteState && [',', ')'].includes(getAdjacentChar(str, cursor, 1))) {
          quoteState = false;
        }
      }

      if (!quoteState && char === '}' && nextChar === '}') {
        const closeIndex = cursor;
        const hasLeadingQuote = str[openIndex - 1] === "'";
        const hasTrailingQuote = str[closeIndex + 2] === "'";
        const openingDelimiter = str[openIndex - 2];
        const closingDelimiter = str[closeIndex + 3];
        const placeholder = str.slice(openIndex + 2, closeIndex);

        /* v8 ignore next */
        const isNestedTransformationArgument =
          hasLeadingQuote &&
          hasTrailingQuote &&
          ['(', ',', '[', '|'].includes(openingDelimiter ?? '') &&
          [')', ',', ']'].includes(closingDelimiter ?? '');

        if (!placeholder) {
          result += str.slice(openIndex, closeIndex + 2);
        } else if (isNestedTransformationArgument) {
          result += str.slice(openIndex, closeIndex + 2);
        } else {
          result += replacer(str.slice(openIndex, closeIndex + 2), placeholder);
        }

        searchIndex = closeIndex + 2;
        break;
      }

      cursor += 1;
    }

    if (cursor >= str.length) {
      result += str.slice(openIndex);
      break;
    }
  }

  return result;
};

/**
 * Split a template into the contents of its template tags and the literal text around them, finding
 * the tags like {@link replaceTemplateTags} does.
 * @param {string} str The string containing template tags.
 * @returns {{ tags: string[], literals: string[] }} Content of each tag in the order they appear,
 * e.g. `fields.title | upper` for `{{fields.title | upper}}`, and the literal text before each tag
 * followed by the trailing text, so there is one more literal than tags. Joining the literals with
 * `TAG_PLACEHOLDER` gives the template with each tag replaced by the placeholder.
 */
export const splitTemplateTags = (str) => {
  /** @type {string[]} */
  const tags = [];

  const literals = replaceTemplateTags(str, (_match, placeholder) => {
    tags.push(placeholder);

    return TAG_PLACEHOLDER;
  }).split(TAG_PLACEHOLDER);

  return { tags, literals };
};

/**
 * Checks if a string contains template tags.
 * @param {string} str The string to check.
 * @returns {boolean} True if the string contains template tags, false otherwise.
 */
export const hasTemplateTags = (str) => TEMPLATE_TAG_REGEX.test(str);
