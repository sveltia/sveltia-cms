import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import { hasField } from '$lib/services/config/parser/utils/fields';
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
 * Prefix that marks a template tag as an explicit reference to an entry field.
 */
const FIELD_TAG_PREFIX = 'fields.';
/**
 * Pattern matching a `default` transformation, which supplies a value of its own when the tag
 * resolves to nothing, so an undefined field is no longer a problem.
 */
const DEFAULT_TRANSFORMATION_REGEX = /\|\s*default\s*\(/;

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
 * Check the `{{fields.*}}` tags in the `preview_path` option. A tag that names no field can’t be
 * filled in, and the preview link is dropped rather than pointing at a URL built from a missing
 * value, so the collection silently loses its link.
 *
 * Only tags carrying the explicit `fields.` prefix are checked. A bare tag such as `{{title}}` may
 * be either a field or one of the special tags the replacer handles first, and telling the two
 * apart here would report the special ones as missing fields.
 * @param {object} args Arguments.
 * @param {string} args.pathTemplate The `preview_path` option value.
 * @param {Field[]} args.fields Fields the template can read a value from.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkFieldTags = ({ pathTemplate, fields, context, collectors }) => {
  [...pathTemplate.matchAll(TEMPLATE_TAG_REPLACE_REGEX)].forEach(([, tag]) => {
    // A transformation follows the tag name after a pipe. The name itself never contains one, so
    // the first segment is the key path even when an argument does
    const keyPath = tag.split('|')[0].trim();

    if (!keyPath.startsWith(FIELD_TAG_PREFIX) || DEFAULT_TRANSFORMATION_REGEX.test(tag)) {
      return;
    }

    if (!hasField(fields, keyPath.slice(FIELD_TAG_PREFIX.length))) {
      addMessage({
        type: 'warning',
        strKey: 'preview_path_field_not_found',
        values: { name: keyPath },
        context,
        collectors,
      });
    }
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
  checkFieldTags({ pathTemplate, fields, context, collectors });
};
