import { isObject } from '@sveltia/utils/object';

import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';
import {
  parseCustomSortableFields,
  parseViewOptions,
} from '$lib/services/contents/collection/view/utils';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 * @import {
 * CmsConfig,
 * EntryCollection,
 * Field,
 * FieldKeyPath,
 * FieldWithSubFields,
 * FieldWithTypes,
 * ListFieldWithSubField,
 * ViewFilter,
 * ViewFilters,
 * ViewGroup,
 * ViewGroups,
 * } from '$lib/types/public';
 */

/**
 * Entry metadata property keys that can be used in the `sortable_fields`, `view_groups` and
 * `view_filters` options in place of a field key path. These are resolved by `getPropertyValue()`
 * from the entry itself rather than the collection’s `fields`.
 * @type {string[]}
 */
const METADATA_KEYS = ['slug', 'commit_author', 'commit_date'];
/**
 * Internal sort keys added by `getSortConfig()` that don’t map to a field: `_summary` for the
 * generated entry summary and `_manual` for the reorder field.
 * @type {string[]}
 */
const INTERNAL_SORT_KEYS = ['_summary', '_manual'];
/**
 * Regular expression to match the explicit variable type in a key path segment, e.g. the `<button>`
 * part of `body<button>`.
 * @type {RegExp}
 */
const EXPLICIT_TYPE_REGEX = /<[^>]+>$/;

/**
 * Get the sub fields of the given field configuration: the single subfield of a List field, the
 * subfields of a List or Object field, or the subfields of all the variable types.
 * @param {Field} field Field configuration.
 * @returns {Field[]} Sub fields. An empty array if the field doesn’t have any.
 */
const getSubFields = (field) => {
  const { field: subField } = /** @type {ListFieldWithSubField} */ (field);
  const { fields: subFields } = /** @type {FieldWithSubFields} */ (field);
  const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (field);

  if (subField) {
    return [subField];
  }

  if (subFields) {
    return subFields;
  }

  if (types) {
    return [
      // Any of the types could be used for an item, so accept a subfield of any of them
      ...types.flatMap(({ fields: typeFields = [] }) => typeFields),
      // The type key, e.g. `blocks.0.type`, is a valid property although it’s not a field
      /** @type {Field} */ ({ name: typeKey }),
    ];
  }

  return [];
};

/**
 * Check if the given key path points to a field defined in the given field list. This is a lenient
 * version of `getField()`, which lives in the runtime module graph (stores, backends) this parser
 * runs before, and which needs entry values to resolve variable types.
 * @internal
 * @param {Field[]} fields Field list.
 * @param {FieldKeyPath} keyPath Field key path, e.g. `author.name` or `images.0.src`.
 * @returns {boolean} Whether the field is defined.
 */
export const hasField = (fields, keyPath) => {
  /** @type {Field[]} */
  let candidates = fields;
  /** @type {Field | undefined} */
  let field = undefined;

  const isResolved = keyPath.split('.').every((segment) => {
    // Strip the explicit variable type, which is not part of the field name
    const key = segment.replace(EXPLICIT_TYPE_REGEX, '');

    // A list item index (`authors.0`) or wildcard (`images.*.src`) doesn’t point to a field itself,
    // so stay at the same level
    if (!key || key === '*' || isNumeric(key)) {
      return true;
    }

    if (field) {
      candidates = getSubFields(field);
    }

    field = candidates.find(({ name }) => name === key);

    return !!field;
  });

  return isResolved && !!field;
};

/**
 * Validate the name and field key path of each option in the `view_groups` or `view_filters`
 * option.
 * @param {object} args Arguments.
 * @param {ViewGroup[] | ViewGroups | ViewFilter[] | ViewFilters | undefined} args.config Raw
 * configuration value.
 * @param {{ name?: string, field?: FieldKeyPath }[]} args.options Parsed view group or filter
 * options.
 * @param {Field[]} args.fields Collection fields.
 * @param {'view_group' | 'view_filter'} args.optionType Option type, used for message keys.
 * @param {object} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkNamedViewOptions = ({ config, options, fields, optionType, context, collectors }) => {
  // A `name` is required in the object (Static CMS) format, where an option is referenced by name
  // from the `default` option, as well as the `reorder` option in the case of a group. It’s
  // optional in the array (Netlify/Decap CMS) format, but must still be unique when provided
  const isNameRequired = isObject(config);
  /** @type {Record<string, number>} */
  const nameCounts = {};

  options.forEach((option, index) => {
    const { name, field: key } = isObject(option) ? option : {};

    if (isNameRequired || name !== undefined) {
      checkName({
        name,
        index,
        nameCounts,
        strKeyBase: `${optionType}_name`,
        context,
        collectors,
      });
    }

    // A missing field is not validated here, as it just disables grouping or filtering
    if (typeof key !== 'string' || !key || METADATA_KEYS.includes(key)) {
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
 * @internal
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

  if (sortableFields) {
    const { keys, defaultKey } = parseCustomSortableFields(sortableFields);
    const specialKeys = [...METADATA_KEYS, ...INTERNAL_SORT_KEYS];

    [...keys, defaultKey].forEach((key) => {
      if (key && !specialKeys.includes(key) && !hasField(fields, key)) {
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
    optionType: 'view_group',
    context,
    collectors,
  });

  checkNamedViewOptions({
    config: viewFilters,
    options: parseViewOptions(viewFilters, 'filters').options,
    fields,
    optionType: 'view_filter',
    context,
    collectors,
  });
};
