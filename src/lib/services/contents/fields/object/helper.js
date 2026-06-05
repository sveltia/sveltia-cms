import { escapeRegExp } from '@sveltia/utils/string';

import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import { TRANSFORMATION_SPLIT_REGEX } from '$lib/services/common/transformations';
import {
  getFieldDisplayValue,
  getVisibleFieldDisplayValue,
} from '$lib/services/contents/entry/fields';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { FlattenedEntryContent, GetFieldArgs, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Cache of pre-compiled regexes keyed by field key path.
 * @type {Map<FieldKeyPath, RegExp>}
 */
const objectSummaryRegexCache = new Map();

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
    const keyPathRegex = getOrCreate(
      objectSummaryRegexCache,
      keyPath,
      () => new RegExp(`^${escapeRegExp(keyPath)}\\.`),
    );

    return getVisibleFieldDisplayValue({ valueMap, locale, keyPath, keyPathRegex, getFieldArgs });
  }

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
    const [tag, ...transformations] = placeholder.split(TRANSFORMATION_SPLIT_REGEX);

    return getFieldDisplayValue({
      ...getFieldArgs,
      keyPath: `${keyPath}.${tag.replace(/^fields\./, '')}`,
      locale,
      transformations,
    });
  };

  return summaryTemplate.replaceAll(TEMPLATE_TAG_REPLACE_REGEX, replacer);
};
