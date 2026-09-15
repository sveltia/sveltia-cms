import { isObject } from '@sveltia/utils/object';

import {
  getCanonicalSlugKey,
  hasField,
  METADATA_KEYS,
} from '$lib/services/config/parser/utils/fields';
import { addMessage, checkRegex } from '$lib/services/config/parser/utils/validator';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { EntryCollection } from '$lib/types/public';
 */

/**
 * Check the `filter` option of an entry collection. An entry that doesn’t pass the filter is left
 * out of the collection, so a filter that can never pass — one on a field no entry has, or one
 * with nothing to match against — shows up as an empty collection rather than as an error.
 * @param {object} args Arguments.
 * @param {EntryCollection} args.collection Collection config to check.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 * @see https://decapcms.org/docs/collection-folder/#filtered-folder-collections
 */
export const checkCollectionFilter = ({ collection, context, collectors }) => {
  const { fields, filter } = collection;

  // The type of the option is checked against the JSON schema
  if (!isObject(filter)) {
    return;
  }

  const { field, value, pattern } = filter;

  // A collection without fields is reported separately, and a field of the wrong type against the
  // JSON schema. A metadata key such as `slug` is read from the entry rather than its content, and
  // the canonical slug key such as `translationKey` is part of the content without being a field
  if (
    typeof field === 'string' &&
    field &&
    !METADATA_KEYS.includes(field) &&
    field !== getCanonicalSlugKey({ cmsConfig: context.cmsConfig, collection }) &&
    fields?.length &&
    !hasField(fields, field)
  ) {
    addMessage({ strKey: 'invalid_filter_field', values: { name: field }, context, collectors });
  }

  if (value === undefined && pattern === undefined) {
    addMessage({ strKey: 'invalid_filter_no_condition', context, collectors });
  }

  checkRegex({ option: 'filter', pattern, context, collectors });
};
