import { replaceTemplateTags } from '$lib/services/common/template';
import { processNestedTemplates } from '$lib/services/common/template/nested';
import { parseTransformations } from '$lib/services/common/transformations';
import {
  getFieldDisplayValue,
  getVisibleFieldDisplayValue,
} from '$lib/services/contents/entry/fields';

/**
 * @import { FlattenedEntryContent, GetFieldArgs, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Format the summary template of an Object field.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {FlattenedEntryContent} args.valueMap Entry content.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} [args.summaryTemplate] Summary template, e.g. `{{fields.slug}}`.
 * @returns {string} Formatted summary.
 */
export const formatSummary = ({
  collectionName,
  fileName,
  keyPath,
  valueMap,
  isIndexFile = false,
  locale,
  summaryTemplate,
}) => {
  /** @type {GetFieldArgs} */
  const getFieldArgs = { collectionName, fileName, keyPath: '', valueMap, isIndexFile };

  if (!summaryTemplate) {
    return getVisibleFieldDisplayValue({
      valueMap,
      locale,
      keyPath,
      keyPathPrefix: `${keyPath}.`,
      getFieldArgs,
    });
  }

  /**
   * Get field value by tag for nested template processing.
   * @param {string} innerTag Inner tag to process.
   * @returns {string} Field value.
   */
  const getFieldValue = (innerTag) => {
    const { value: innerFieldTag } = parseTransformations(innerTag);

    return getFieldDisplayValue({
      ...getFieldArgs,
      keyPath: `${keyPath}.${innerFieldTag.replace(/^fields\./, '')}`,
      locale,
    });
  };

  /**
   * Replacer function for template tags in the summary template. It extracts the field value based
   * on the placeholder, applies any transformations, and returns the display value to replace the
   * tag.
   * @param {string} _match The entire matched template tag, e.g. `{{fields.slug | upper}}`. Unused
   * in the function but required by the `replace` method.
   * @param {string} placeholder The content inside the template tag, e.g. `fields.slug | upper`.
   * @returns {string} The display value to replace the template tag.
   */
  const replacer = (_match, placeholder) => {
    const { value: tag, transformations: parsedTransformations } =
      parseTransformations(placeholder);

    return getFieldDisplayValue({
      ...getFieldArgs,
      keyPath: `${keyPath}.${tag.replace(/^fields\./, '')}`,
      locale,
      transformations: processNestedTemplates(parsedTransformations, getFieldValue),
    });
  };

  return replaceTemplateTags(summaryTemplate, replacer);
};

/**
 * Get the message logged when an Object field value or a List field item doesn’t have a type that
 * the field defines, so the developer can fix the content or the configuration.
 * @param {object} args Arguments.
 * @param {'object' | 'list'} args.fieldType Type of the field holding the value.
 * @param {string | undefined} args.type Type the value has, if any.
 * @param {string} args.typeKey Property holding the type.
 * @param {{ name: string }[]} args.types Types the field defines.
 * @returns {string} Message.
 */
export const getUnknownTypeMessage = ({ fieldType, type, typeKey, types }) => {
  const target = fieldType === 'list' ? 'list item' : 'object';

  return type
    ? `The “${type}” type is not defined for the ${fieldType} field.`
    : `The type key is not found in the ${target}. The item must include the “${typeKey}” ` +
        `property with one of the defined types: ${types.map((t) => t.name).join(', ')}`;
};
