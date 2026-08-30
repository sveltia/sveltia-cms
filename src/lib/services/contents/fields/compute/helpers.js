import { replaceTemplateTags } from '$lib/services/common/template';
import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';
import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';
import { getListFormatter } from '$lib/services/contents/i18n';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { ComputeField, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Regular expression to match the `fields.` prefix of a template tag, e.g. `{{fields.title}}`.
 */
const FIELD_TAG_PREFIX_REGEX = /^fields\./;

/**
 * Get the list index found in the given key path, which is the second-to-last segment, e.g. `2` for
 * `authors.2.slug`.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @returns {number | undefined} Index, or `undefined` if the field is not in a list item.
 * @see https://github.com/sveltia/sveltia-cms/issues/172
 */
export const getListIndex = (keyPath) => {
  const [index] = keyPath.split('.').splice(-2, 1);

  return index && isNumeric(index) ? Number(index) : undefined;
};

/**
 * Resolve the `value` template of a Compute field.
 * @param {object} args Arguments.
 * @param {ComputeField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content the template is resolved
 * against.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @returns {string | number} Computed value.
 */
export const getComputedValue = ({
  fieldConfig,
  keyPath,
  locale,
  valueMap,
  collectionName,
  fileName,
  isIndexFile = false,
}) => {
  const { value: valueTemplate = '' } = fieldConfig;

  // A lone `{{index}}` yields the number itself rather than its string representation, so that the
  // value is written to the file as a number
  if (valueTemplate === '{{index}}') {
    return getListIndex(keyPath) ?? '';
  }

  const listFormatter = getListFormatter(locale);

  return replaceTemplateTags(valueTemplate, (_match, placeholder) => {
    const { value: tagName, transformations } = parseTransformations(placeholder);

    if (tagName === 'index') {
      return String(getListIndex(keyPath) ?? '');
    }

    if (!FIELD_TAG_PREFIX_REGEX.test(tagName)) {
      return '';
    }

    let value = getFieldDisplayValue({
      collectionName,
      fileName,
      valueMap,
      keyPath: tagName.replace(FIELD_TAG_PREFIX_REGEX, ''),
      locale,
      isIndexFile,
    });

    value = Array.isArray(value) ? listFormatter.format(value) : String(value);

    if (transformations.length) {
      return applyTransformations({ value, transformations, locale });
    }

    return value;
  });
};
