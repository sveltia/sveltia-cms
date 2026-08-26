import { addMessage } from '$lib/services/config/parser/utils/validator';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Template tags in the `preview_path` option that can only be filled in from a DateTime field’s
 * value. The pattern is duplicated from the entry service rather than imported, because that module
 * lives in the runtime module graph (stores, backends) this parser runs before.
 */
const DATE_TIME_TEMPLATE_REGEX = /{{(?:year|month|day|hour|minute|second)}}/;

/**
 * Validate the `preview_path` option against the fields available to fill it in. A template with
 * date and time tags needs a DateTime field to read them from, and without one the preview link is
 * dropped without explanation, which looks the same as a collection that has no preview link
 * configured at all.
 *
 * Only the configuration can be checked here. A DateTime field that exists but holds no value
 * produces the same missing link, and that isn’t known until an entry is loaded.
 * @param {object} args Arguments.
 * @param {string} [args.pathTemplate] The `preview_path` option value.
 * @param {string} [args.dateFieldName] The `preview_path_date_field` option value.
 * @param {Field[]} args.fields Fields the template can read a date from.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkPreviewPath = ({ pathTemplate, dateFieldName, fields, context, collectors }) => {
  if (!pathTemplate || !DATE_TIME_TEMPLATE_REGEX.test(pathTemplate)) {
    return;
  }

  // Mirrors how `extractDateTime()` looks the field up at runtime: a named field must be a DateTime
  // field, and without a name the first DateTime field is used
  const found = dateFieldName
    ? fields.some(({ widget, name }) => widget === 'datetime' && name === dateFieldName)
    : fields.some(({ widget }) => widget === 'datetime');

  if (found) {
    return;
  }

  addMessage({
    type: 'warning',
    strKey: dateFieldName ? 'preview_path_date_field_not_found' : 'preview_path_no_date_field',
    values: { name: dateFieldName },
    context,
    collectors,
  });
};
