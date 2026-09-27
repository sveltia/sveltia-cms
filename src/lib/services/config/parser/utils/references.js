import {
  DEFAULT_TRANSFORMATION_REGEX,
  FIELD_TAG_PREFIX_REGEX,
  TEMPLATE_TAG_REPLACE_REGEX,
} from '$lib/services/common/template/constants';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { findFields, hasField } from '$lib/services/config/parser/utils/fields';
import { addMessage } from '$lib/services/config/parser/utils/validator';
import { MEDIA_FIELD_TYPES } from '$lib/services/contents/fields';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

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
 * @param {'error' | 'warning'} [args.type] Type of the message reported for a missing field.
 * Defaults to an error.
 * @param {string} [args.strKey] Key of the message reported for a missing field. The message can
 * use the `option` and `name` values.
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
  type,
  strKey = 'option_field_not_found',
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
    if (!hasField(fields, stripFieldTagPrefix(keyPath))) {
      addMessage({
        type,
        strKey,
        values: { option, name: keyPath },
        context,
        collectors,
      });
    }
  });
};

/**
 * Check that the `thumbnail` option of a List or Object field names an Image or File subfield. Any
 * other field type is skipped at runtime, so no thumbnail is shown.
 * @param {object} args Arguments.
 * @param {any} args.thumbnail The `thumbnail` option. A value of another type is reported against
 * the JSON schema, so it’s ignored here.
 * @param {Field[]} args.fields Subfields the option can refer to.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkThumbnailField = ({ thumbnail, fields, context, collectors }) => {
  checkFieldReferences({ option: 'thumbnail', keyPaths: thumbnail, fields, context, collectors });

  if (typeof thumbnail !== 'string' || !thumbnail) {
    return;
  }

  // A name shared by the subfields of several variable types resolves to each of them, and the
  // runtime looks the field up per item type, so any Image or File field among them will do
  const fieldTypes = findFields(fields, stripFieldTagPrefix(thumbnail)).map(
    ({ widget: fieldType = 'string' }) => fieldType,
  );

  // A missing field is reported above
  if (fieldTypes.length && !fieldTypes.some((fieldType) => MEDIA_FIELD_TYPES.includes(fieldType))) {
    addMessage({
      strKey: 'thumbnail_field_not_media',
      values: { name: thumbnail, widget: fieldTypes[0] },
      context,
      collectors,
    });
  }
};
