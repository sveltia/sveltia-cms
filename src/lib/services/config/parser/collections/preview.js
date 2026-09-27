import { DATE_TIME_TEMPLATE_REGEX } from '$lib/services/common/template/constants';
import { checkFieldReferences } from '$lib/services/config/parser/utils/references';
import { addMessage } from '$lib/services/config/parser/utils/validator';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Check the date and time tags in the `preview_path` option. A template with such tags needs a
 * DateTime field to read them from, and without one the preview link is dropped without
 * explanation, which looks the same as a collection that has no preview link configured at all.
 * @param {object} args Arguments.
 * @param {string} args.pathTemplate The `preview_path` option value.
 * @param {string} [args.dateFieldName] The `preview_path_date_field` option value.
 * @param {Field[]} args.fields Fields the template can read a date from.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkDateTimeTags = ({ pathTemplate, dateFieldName, fields, context, collectors }) => {
  if (!DATE_TIME_TEMPLATE_REGEX.test(pathTemplate)) {
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

/**
 * Validate the `preview_path` option against the fields available to fill it in.
 *
 * Only the configuration can be checked here. A field that exists but holds no value produces the
 * same missing link, and that isn’t known until an entry is loaded.
 * @param {object} args Arguments.
 * @param {string} [args.pathTemplate] The `preview_path` option value.
 * @param {string} [args.dateFieldName] The `preview_path_date_field` option value.
 * @param {Field[]} args.fields Fields the template can read a value from.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkPreviewPath = ({ pathTemplate, dateFieldName, fields, context, collectors }) => {
  if (!pathTemplate) {
    return;
  }

  checkDateTimeTags({ pathTemplate, dateFieldName, fields, context, collectors });
  // A tag that names no field can’t be filled in, and the preview link is dropped rather than
  // pointing at a URL built from a missing value, so the collection silently loses its link. Only
  // tags carrying the explicit `fields.` prefix are checked: a bare tag such as `{{title}}` may be
  // either a field or one of the special tags the replacer handles first, and telling the two apart
  // here would report the special ones as missing fields
  checkFieldReferences({
    option: 'preview_path',
    template: pathTemplate,
    prefixedOnly: true,
    type: 'warning',
    strKey: 'preview_path_field_not_found',
    fields,
    context,
    collectors,
  });
};
