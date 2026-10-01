import { processNestedTemplates } from '$lib/services/common/template/nested';
import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { parseTransformations } from '$lib/services/common/transformations';
import { getField } from '$lib/services/contents/entry/fields';
import {
  getFieldDisplayValue,
  getVisibleFieldDisplayValue,
} from '$lib/services/contents/entry/values';

/**
 * @import {
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalLocaleCode,
 * StringTransformation,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, ListField } from '$lib/types/public';
 */

/**
 * Format the summary template of an Object field, or of a List field item when `itemKeyPath` is
 * given.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {FieldKeyPath} [args.itemKeyPath] Key path of the value to summarize, e.g. `images.0` for
 * the first item of a List field. Defaults to `keyPath`.
 * @param {FlattenedEntryContent} args.valueMap Entry content.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} [args.summaryTemplate] Summary template, e.g. `{{fields.slug}}`.
 * @param {boolean} [args.hasSingleSubField] Whether the field is a List field with a single `field`
 * instead of multiple `fields`, so the item is the value itself.
 * @returns {string} Formatted summary.
 */
export const formatSummary = ({
  collectionName,
  fileName,
  keyPath,
  itemKeyPath = keyPath,
  valueMap,
  isIndexFile = false,
  locale,
  summaryTemplate,
  hasSingleSubField = false,
}) => {
  /** @type {GetFieldArgs} */
  const getFieldArgs = { collectionName, fileName, keyPath: '', valueMap, isIndexFile };

  if (!summaryTemplate) {
    if (hasSingleSubField) {
      return valueMap[itemKeyPath];
    }

    return getVisibleFieldDisplayValue({
      valueMap,
      locale,
      keyPath: itemKeyPath,
      keyPathPrefix: `${itemKeyPath}.`,
      getFieldArgs,
    });
  }

  /**
   * Get the display value of the subfield a template tag refers to.
   * @param {string} tag Template tag without transformations, e.g. `fields.slug`.
   * @param {StringTransformation[]} [parsedTransformations] Transformations to apply, which may
   * contain nested template tags. Omitted for a nested tag, which can’t have transformations.
   * @returns {string} Display value.
   */
  const getDisplayValue = (tag, parsedTransformations) => {
    const fieldName = stripFieldTagPrefix(tag);

    if (hasSingleSubField) {
      // For single-field lists, check if the requested field name matches the actual field name
      const listFieldConfig = /** @type {ListField} */ (getField({ ...getFieldArgs, keyPath }));

      if (!('field' in listFieldConfig) || listFieldConfig.field.name !== fieldName) {
        return '';
      }
    }

    return getFieldDisplayValue({
      ...getFieldArgs,
      keyPath: hasSingleSubField ? itemKeyPath : `${itemKeyPath}.${fieldName}`,
      locale,
      transformations: parsedTransformations
        ? processNestedTemplates(parsedTransformations, (innerTag) =>
            getDisplayValue(parseTransformations(innerTag).value),
          )
        : undefined,
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
    const { value: tag, transformations } = parseTransformations(placeholder);

    return getDisplayValue(tag, transformations);
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
