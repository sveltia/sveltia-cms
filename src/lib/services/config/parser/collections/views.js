import { isObject } from '@sveltia/utils/object';

import {
  getCanonicalSlugKey,
  hasField,
  METADATA_KEYS,
} from '$lib/services/config/parser/utils/fields';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';
import {
  parseCustomSortableFields,
  parseViewOptions,
} from '$lib/services/contents/collection/view/utils';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 * @import {
 * CmsConfig,
 * EntryCollection,
 * Field,
 * FieldKeyPath,
 * ViewFilter,
 * ViewFilters,
 * ViewGroup,
 * ViewGroups,
 * } from '$lib/types/public';
 */

/**
 * Internal sort keys added by `getSortConfig()` that don’t map to a field: `_summary` for the
 * generated entry summary and `_manual` for the reorder field.
 * @type {string[]}
 */
const INTERNAL_SORT_KEYS = ['_summary', '_manual'];

/**
 * Validate the name and field key path of each option in the `view_groups` or `view_filters`
 * option.
 * @param {object} args Arguments.
 * @param {ViewGroup[] | ViewGroups | ViewFilter[] | ViewFilters | undefined} args.config Raw
 * configuration value.
 * @param {{ name?: string, field?: FieldKeyPath }[]} args.options Parsed view group or filter
 * options.
 * @param {Field[]} args.fields Collection fields.
 * @param {string[]} args.specialKeys Keys that are resolved without a field definition.
 * @param {'view_group' | 'view_filter'} args.optionType Option type, used for message keys.
 * @param {object} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkNamedViewOptions = ({
  config,
  options,
  fields,
  specialKeys,
  optionType,
  context,
  collectors,
}) => {
  // A `name` is required in the object (Static CMS) format, where an option is referenced by name
  // from the `default` option, as well as the `reorder` option in the case of a group. It’s
  // optional in the array (Netlify/Decap CMS) format, but must still be unique when provided
  const isNameRequired = isObject(config);
  /** @type {Record<string, number>} */
  const nameCounts = {};

  options.forEach((option, index) => {
    const { name, field: key } = isObject(option) ? option : {};

    checkName({
      name,
      index,
      nameCounts,
      strKeyBase: `${optionType}_name`,
      context,
      collectors,
      required: isNameRequired,
    });

    // A missing field is not validated here, as it just disables grouping or filtering
    if (typeof key !== 'string' || !key || specialKeys.includes(key)) {
      return;
    }

    if (!hasField(fields, key)) {
      addMessage({
        strKey: `invalid_${optionType}_field`,
        values: { name: key },
        context,
        collectors,
      });
    }
  });
};

/**
 * Validate the `sortable_fields`, `view_groups` and `view_filters` options of an entry collection:
 * the field key paths they refer to, and the name of each view group and filter. An unknown key
 * path is silently ignored at runtime — a sort key disappears from the Sort menu, and a group or
 * filter yields no result — which is hard to tell from a working configuration. Each of these
 * options supports both an array (Netlify/Decap CMS compatible) and an object (Static CMS
 * compatible) format, so the raw options are read through the same parsers the runtime uses, and
 * the option lookup can’t diverge from it.
 * @param {object} context Context.
 * @param {CmsConfig} context.cmsConfig Raw CMS configuration.
 * @param {EntryCollection} context.collection Collection config to parse.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @see https://sveltiacms.app/en/docs/collections/entries#managing-entry-views
 */
export const checkViewOptions = (context, collectors) => {
  const {
    fields,
    sortable_fields: sortableFields,
    view_groups: viewGroups,
    view_filters: viewFilters,
  } = context.collection;

  // A collection without fields is reported separately; checking key paths against an empty field
  // list would only repeat that error for every view option
  if (!fields?.length) {
    return;
  }

  // A metadata key such as `slug` is read from the entry rather than its content, and the canonical
  // slug key such as `translationKey` is part of the content without being a field
  const canonicalSlugKey = getCanonicalSlugKey({
    cmsConfig: context.cmsConfig,
    collection: context.collection,
  });

  const specialKeys = [...METADATA_KEYS, ...(canonicalSlugKey ? [canonicalSlugKey] : [])];

  if (sortableFields) {
    const { keys, defaultKey } = parseCustomSortableFields(sortableFields);
    const sortKeys = [...specialKeys, ...INTERNAL_SORT_KEYS];

    [...keys, defaultKey].forEach((key) => {
      if (key && !sortKeys.includes(key) && !hasField(fields, key)) {
        addMessage({
          strKey: 'invalid_sortable_field',
          values: { name: key },
          context,
          collectors,
        });
      }
    });
  }

  checkNamedViewOptions({
    config: viewGroups,
    options: parseViewOptions(viewGroups, 'groups').options,
    fields,
    specialKeys,
    optionType: 'view_group',
    context,
    collectors,
  });

  checkNamedViewOptions({
    config: viewFilters,
    options: parseViewOptions(viewFilters, 'filters').options,
    fields,
    specialKeys,
    optionType: 'view_filter',
    context,
    collectors,
  });
};
