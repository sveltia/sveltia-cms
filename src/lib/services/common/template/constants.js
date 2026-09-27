/**
 * Simple regex to check if a string contains template tags. This can be used for a quick check
 * before performing more expensive operations like regex replacement. The `g` flag should not be
 * used here because we only need to know if at least one match exists, and using `test()` with a
 * global regex can lead to unexpected results due to the internal state of the regex engine.
 */
export const TEMPLATE_TAG_REGEX = /{{(.+?)}}/;

/**
 * Regex to match and replace template tags like {{slug}}.
 */
export const TEMPLATE_TAG_REPLACE_REGEX = new RegExp(TEMPLATE_TAG_REGEX.source, 'g');

/**
 * Regex to match escaped `{{variable}}` placeholders.
 */
export const ESCAPED_PLACEHOLDER_REGEX = /\\\{\\\{.+?\\\}\\\}/g;

/**
 * Date-time field names that are supported as template tags.
 */
export const DATE_TIME_FIELDS = ['year', 'month', 'day', 'hour', 'minute', 'second'];

/**
 * Regex to check if a template, such as an entry file path or the `preview_path` option, contains a
 * date and time tag, which can only be filled in from a DateTime field’s value.
 */
export const DATE_TIME_TEMPLATE_REGEX = /{{(?:year|month|day|hour|minute|second)}}/;

/**
 * Regex to match the prefix that marks a template tag as an explicit reference to an entry field,
 * e.g. `fields.` in `{{fields.title}}`.
 */
export const FIELD_TAG_PREFIX_REGEX = /^fields\./;

/**
 * Regex to match a `default` transformation, which supplies a value of its own when the tag
 * resolves to nothing, so an undefined field is no longer a problem.
 */
export const DEFAULT_TRANSFORMATION_REGEX = /\|\s*default\s*\(/;

/**
 * Regex to match inner tags within transformation values.
 */
export const INNER_TAG_REGEX = /^{{(?<innerTag>.+?)}}$/;

/**
 * UUID generator functions mapped by tag name.
 * Note: Functions are called dynamically to generate UUIDs on demand.
 */
export const UUID_TYPES = {
  uuid: 'uuid',
  uuid_short: 'uuid_short',
  uuid_shorter: 'uuid_shorter',
};
