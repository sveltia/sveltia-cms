import { isObject } from '@sveltia/utils/object';

import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { hasSlugTag } from '$lib/services/config/parser/collections/array-file';
import { checkMultipleDefault } from '$lib/services/config/parser/utils/defaults';
import { getCanonicalSlugKey, hasField } from '$lib/services/config/parser/utils/fields';
import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';
import { getPublishMode } from '$lib/services/workflow/config';

/**
 * @import {
 * ConfigParserCollectors,
 * ConfigParserContext,
 * FieldParserArgs,
 * InternalSingletonCollection,
 * UnsupportedOption,
 * } from '$lib/types/private';
 * @import {
 * Collection,
 * CollectionDivider,
 * CollectionFile,
 * EntryCollection,
 * Field,
 * RelationField,
 * } from '$lib/types/public';
 */

/**
 * Template tags that can be used in the `value_field` option but don’t refer to a field in the
 * referenced collection or file: `{{slug}}` is the entry slug and `{{locale}}` is the locale of the
 * entry. Note that the `slug` field of an entry is referenced as `{{fields.slug}}` or `slug`.
 * @type {string[]}
 */
const SPECIAL_TEMPLATE_TAGS = ['slug', 'locale'];

/**
 * Unsupported options for Relation fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  // Deprecated camelCase options in Netlify/Decap CMS config, should be converted to snake_case.
  { prop: 'displayFields', newProp: 'display_fields' },
  { prop: 'searchFields', newProp: 'search_fields' },
  { prop: 'valueField', newProp: 'value_field' },
  // Sveltia CMS doesn’t have performance issues with many related entries, so this option is not
  // applicable.
  { type: 'warning', prop: 'options_length', strKey: 'unsupported_ignored_option' },
];

/**
 * Options of a Relation field that refer to fields defined in the referenced collection or file,
 * with the i18n string key used to report an unknown one. A reference is either a plain field name
 * or a template, with the same syntax; `display_fields` and `search_fields` hold a list of them.
 * @type {{ option: string, strKey: string, list: boolean }[]}
 */
const FIELD_REFERENCE_OPTIONS = [
  { option: 'value_field', strKey: 'relation_field_invalid_value_field', list: false },
  { option: 'display_fields', strKey: 'relation_field_invalid_display_field', list: true },
  { option: 'search_fields', strKey: 'relation_field_invalid_search_field', list: true },
];

/**
 * Validate a field reference in a Relation field option, which refers to one or more fields defined
 * in the referenced collection or file. An unknown key path is not reported at runtime — the widget
 * silently falls back to the entry summary or slug — so the stored, displayed or searched values
 * end up being something other than what the configuration asks for.
 * @param {object} args Arguments.
 * @param {string} args.reference The reference, e.g. `userId`, `name.first`, `cities.*.id` or
 * `{{locale}}/{{slug}}`.
 * @param {string} args.strKey The i18n string key for an unknown field.
 * @param {Field[]} args.fields Fields defined in the referenced collection or file.
 * @param {string | undefined} args.canonicalSlugKey The canonical slug key of the referenced
 * collection or file, if i18n is enabled. It’s not a field but can be referred to as one.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkFieldReference = ({
  reference,
  strKey,
  fields,
  canonicalSlugKey,
  context,
  collectors,
}) => {
  const tags = [...reference.matchAll(TEMPLATE_TAG_REPLACE_REGEX)].map(([, tag]) => tag);

  // A plain field name like `userId` is equivalent to `{{userId}}`, meaning that `slug` refers to
  // the `slug` field while `{{slug}}` refers to the entry slug
  const keyPaths = tags.length
    ? tags.filter((tag) => !SPECIAL_TEMPLATE_TAGS.includes(tag))
    : [reference];

  keyPaths.forEach((keyPath) => {
    // The `fields.` prefix is supported for compatibility with other config options
    const key = stripFieldTagPrefix(keyPath);

    if (key !== canonicalSlugKey && !hasField(fields, key)) {
      addMessage({ strKey, context, collectors, values: { field: keyPath } });
    }
  });
};

/**
 * Validate the `value_field`, `display_fields` and `search_fields` options of a Relation field
 * against the fields defined in the referenced collection or file.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Relation field configuration.
 * @param {Field[]} args.fields Fields defined in the referenced collection or file.
 * @param {string | undefined} args.canonicalSlugKey The canonical slug key of the referenced
 * collection or file, if i18n is enabled.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkFieldReferences = ({ fieldConfig, fields, canonicalSlugKey, context, collectors }) => {
  const { filters } = fieldConfig;

  // A filter’s `field` is a single key path, where `slug` is the entry slug and the `fields.`
  // prefix marks a field, the same as in a template. A filter on an unknown field matches no
  // entry, so the field is left with nothing to choose from
  if (Array.isArray(filters)) {
    filters.forEach((filter) => {
      const field = isObject(filter) ? filter.field : undefined;

      if (typeof field === 'string' && field && field !== 'slug') {
        const key = stripFieldTagPrefix(field);

        if (key !== canonicalSlugKey && !hasField(fields, key)) {
          addMessage({
            strKey: 'relation_field_invalid_filter_field',
            context,
            collectors,
            values: { field },
          });
        }
      }
    });
  }

  FIELD_REFERENCE_OPTIONS.forEach(({ option, strKey, list }) => {
    const value = /** @type {Record<string, any>} */ (fieldConfig)[option];

    // A value of the wrong type is reported against the JSON schema, so it’s skipped here, and so
    // is an empty reference
    if (Array.isArray(value) !== list) {
      return;
    }

    /** @type {any[]} */ (list ? value : [value]).forEach((reference) => {
      if (typeof reference === 'string' && reference) {
        checkFieldReference({ reference, strKey, fields, canonicalSlugKey, context, collectors });
      }
    });
  });
};

/**
 * Validate the `value_field` option of a Relation field referring to an entry collection that
 * stores all the entries in one file. The slug of such an entry is its position in the array, which
 * changes when the entries are reordered or one is deleted, so a stored reference would silently
 * point to another entry. The value has to come from a field instead.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Relation field configuration.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkArrayFileValueField = ({ fieldConfig, context, collectors }) => {
  const { collection, value_field: valueField = '{{slug}}' } = fieldConfig;

  if (hasSlugTag(valueField)) {
    addMessage({
      strKey: 'relation_field_array_file_slug',
      context,
      collectors,
      values: { collection },
    });
  }
};

/**
 * Validate a Relation field in an entry collection that stores all the entries in one file, which
 * can’t refer to a collection with Editorial Workflow. Renaming or deleting an entry there updates
 * the references to it in the same pull request, but the file can only be written as a whole on
 * the configured branch, so the pull request would replace the file with the one entry holding the
 * reference.
 * @param {object} args Arguments.
 * @param {Collection | CollectionDivider | InternalSingletonCollection} args.collection Referenced
 * collection.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkArrayFileWorkflowRelation = ({ collection, context, collectors }) => {
  const { cmsConfig, collection: parentCollection } = context;

  if (
    !parentCollection ||
    !('file' in parentCollection) ||
    typeof parentCollection.file !== 'string' ||
    // A file/singleton collection’s entry can’t be renamed or deleted
    'divider' in collection ||
    'files' in collection ||
    getPublishMode({ cmsConfig, collection }) !== 'editorial_workflow'
  ) {
    return;
  }

  addMessage({
    strKey: 'relation_field_array_file_workflow',
    context,
    collectors,
    values: { collection: collection.name },
  });
};

/**
 * Parse and validate a Relation field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseRelationFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const fieldConfig = /** @type {RelationField} */ (config);

  const {
    collection: collectionName,
    file: fileName,
    default: defaultValue,
    multiple,
  } = fieldConfig;

  const { cmsConfig } = context;

  // Whether the default matches an entry can only be known once the entries are loaded, but its
  // shape is known here
  checkMultipleDefault({ defaultValue, multiple, context, collectors });

  const collection =
    collectionName === '_singletons'
      ? /** @type {InternalSingletonCollection} */ ({
          name: collectionName,
          files: cmsConfig?.singletons,
        })
      : cmsConfig?.collections?.find((col) => col.name === collectionName);

  /** @type {CollectionFile | undefined} */
  let file = undefined;
  /** @type {string | undefined} */
  let canonicalSlugKey = undefined;

  // Check if the collection exists
  if (collection) {
    const hasFiles = 'files' in collection && Array.isArray(collection.files);

    if (fileName) {
      // Check if the file exists in the collection
      if (hasFiles) {
        file = /** @type {CollectionFile | undefined} */ (
          collection.files.find((f) => 'file' in f && f.name === fileName)
        );
      }

      if (!file) {
        addMessage({
          strKey: 'relation_field_invalid_collection_file',
          context,
          collectors,
          values: { file: fileName },
        });
      }
    } else if (hasFiles) {
      addMessage({
        strKey: 'relation_field_missing_file_name',
        context,
        collectors,
        values: { collection: collectionName },
      });
    }

    canonicalSlugKey = getCanonicalSlugKey({ cmsConfig, collection, file });

    // A value of the wrong type is reported against the JSON schema
    if (
      'file' in collection &&
      typeof collection.file === 'string' &&
      (fieldConfig.value_field === undefined || typeof fieldConfig.value_field === 'string')
    ) {
      checkArrayFileValueField({ fieldConfig, context, collectors });
    }

    checkArrayFileWorkflowRelation({ collection, context, collectors });
  } else {
    addMessage({
      strKey: 'relation_field_invalid_collection',
      context,
      collectors,
      values: { collection: collectionName },
    });
  }

  // Check if the referenced fields exist in the target collection/file. A collection or file
  // without fields is reported separately, so skip the check in that case to avoid a duplicate
  // error
  const targetFields = fileName
    ? file?.fields
    : /** @type {EntryCollection | undefined} */ (collection)?.fields;

  if (targetFields?.length) {
    checkFieldReferences({
      fieldConfig,
      fields: targetFields,
      canonicalSlugKey,
      context,
      collectors,
    });
  }

  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });

  // Collect relation information for later processing
  collectors.relationFields.add({ fieldConfig, context });
};
