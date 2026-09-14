import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import { hasField } from '$lib/services/config/parser/utils/fields';
import { addMessage } from '$lib/services/config/parser/utils/validator';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Pattern matching the prefix that marks a template tag as an explicit reference to an entry field.
 */
const FIELD_TAG_PREFIX_REGEX = /^fields\./;
/**
 * Pattern matching a `default` transformation, which supplies a value of its own when the tag
 * resolves to nothing, so an undefined field is no longer a problem.
 */
const DEFAULT_TRANSFORMATION_REGEX = /\|\s*default\s*\(/;

/**
 * Check that the fields an option refers to are defined, and report each one that isn’t. The
 * option is either a template, whose `{{tags}}` are checked, or a list of key paths.
 * @param {object} args Arguments.
 * @param {string} args.option Name of the option, for the message.
 * @param {any} [args.template] Template to check, e.g. `{{year}}-{{title}}`. A value of another
 * type is reported against the JSON schema, so it’s ignored here.
 * @param {any} [args.keyPaths] Key path or key paths to check instead of a template.
 * @param {string[]} [args.specialTags] Template tags that the runtime handles without reading a
 * field, such as `slug`. A tag with the `fields.` prefix always refers to a field, so `slug` can be
 * special while `fields.slug` is the field of that name.
 * @param {boolean} [args.prefixedOnly] Whether only the tags with the explicit `fields.` prefix
 * refer to fields, as in a template whose bare tags mean something else.
 * @param {Field[]} args.fields Fields the option can refer to.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkFieldReferences = ({
  option,
  template,
  keyPaths,
  specialTags = [],
  prefixedOnly = false,
  fields,
  context,
  collectors,
}) => {
  /** @type {string[]} */
  const references = [];

  if (typeof template === 'string') {
    [...template.matchAll(TEMPLATE_TAG_REPLACE_REGEX)].forEach(([, tag]) => {
      // A transformation follows the tag name after a pipe. The name itself never contains one,
      // so the first segment is the key path even when an argument does
      const keyPath = tag.split('|')[0].trim();

      if (
        DEFAULT_TRANSFORMATION_REGEX.test(tag) ||
        (prefixedOnly && !FIELD_TAG_PREFIX_REGEX.test(keyPath)) ||
        specialTags.includes(keyPath)
      ) {
        return;
      }

      references.push(keyPath);
    });
  } else {
    /** @type {any[]} */ (Array.isArray(keyPaths) ? keyPaths : [keyPaths]).forEach((keyPath) => {
      if (typeof keyPath === 'string' && keyPath) {
        references.push(keyPath);
      }
    });
  }

  references.forEach((keyPath) => {
    if (!hasField(fields, keyPath.replace(FIELD_TAG_PREFIX_REGEX, ''))) {
      addMessage({
        strKey: 'option_field_not_found',
        values: { option, name: keyPath },
        context,
        collectors,
      });
    }
  });
};
