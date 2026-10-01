import { TEMPLATE_TAG_REGEX } from '$lib/services/common/template/constants';

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

      if (char === "'" && !quoteState) {
        quoteState = true;
      } else if (char === "'" && quoteState) {
        quoteState = false;
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
 * Checks if a string contains template tags.
 * @param {string} str The string to check.
 * @returns {boolean} True if the string contains template tags, false otherwise.
 */
export const hasTemplateTags = (str) => TEMPLATE_TAG_REGEX.test(str);
