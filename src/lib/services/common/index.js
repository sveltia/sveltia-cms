/**
 * Simple regex to check if a string contains template tags. This can be used for a quick check
 * before performing more expensive operations like regex replacement. The `g` flag should not be
 * used here because we only need to know if at least one match exists, and using `test()` with a
 * global regex can lead to unexpected results due to the internal state of the regex engine.
 */
export const TEMPLATE_TAG_REGEX = /{{.+?}}/;

/**
 * Regex to match and replace template tags like {{slug}}. The negative lookahead (?!'\)) ensures
 * that we do not match template tags that are immediately followed by a closing parenthesis and a
 * single quote, which is a common pattern in some templating languages to denote the end of a
 * template expression.
 */
export const TEMPLATE_TAG_REPLACE_REGEX = /{{(.+?)}}(?!'\))/g;
