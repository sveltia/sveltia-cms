import {
  UNSAFE_ASCII_SLUG_CHARS_REGEX,
  UNSAFE_UNICODE_SLUG_CHARS_REGEX,
} from '$lib/services/common/slug/constants';
import { addMessage } from '$lib/services/config/parser/utils/validator';

/**
 * @import { CmsConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Parse and validate the global `slug` options. The type of each option is checked against the JSON
 * schema, so only the rules the schema can’t express are verified here.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseSlugConfig = (cmsConfig, collectors) => {
  const { encoding = 'unicode', sanitize_replacement: replacement } = cmsConfig.slug ?? {};

  // The replacement stands in for the characters a slug can’t contain, so it can’t contain one of
  // them itself: the slug would still end up with the very character the option was meant to
  // remove, e.g. a space, and a slash would even turn the slug into a path. An empty string is
  // fine; it just joins the words together
  if (typeof replacement !== 'string' || !replacement) {
    return;
  }

  const unsafeCharsRegex =
    encoding === 'ascii' ? UNSAFE_ASCII_SLUG_CHARS_REGEX : UNSAFE_UNICODE_SLUG_CHARS_REGEX;

  if (unsafeCharsRegex.test(replacement)) {
    addMessage({
      strKey: 'invalid_sanitize_replacement',
      values: { replacement },
      context: { cmsConfig },
      collectors,
    });
  }
};
