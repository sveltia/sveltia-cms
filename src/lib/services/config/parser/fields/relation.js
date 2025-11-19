/* eslint-disable camelcase */

import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';

/**
 * @import { CollectionFile, RelationField } from '$lib/types/public';
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options for Relation fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  { prop: 'displayFields', newProp: 'display_fields' },
  { prop: 'searchFields', newProp: 'search_fields' },
  { prop: 'valueField', newProp: 'value_field' },
  { type: 'warning', prop: 'options_length', strKey: 'unsupported_ignored_option' },
];

/**
 * Parse and validate a Relation field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseRelationFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const fieldConfig = /** @type {RelationField} */ (config);
  const { collection: collectionName, file: fileName, value_field: valueField } = fieldConfig;
  const { cmsConfig } = context;

  const collection =
    collectionName === '_singletons'
      ? cmsConfig?.singletons
      : cmsConfig?.collections?.find((col) => col.name === collectionName);

  /** @type {CollectionFile | undefined} */
  let file = undefined;

  // Check if the collection exists
  if (collection) {
    const hasFiles = 'files' in collection;

    if (fileName) {
      // Check if the file exists in the collection
      file = hasFiles ? collection.files.find((f) => f.name === fileName) : undefined;

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
  } else {
    addMessage({
      strKey: 'relation_field_invalid_collection',
      context,
      collectors,
      values: { collection: collectionName },
    });
  }

  // @todo Check if the `value_field` exists in the target collection/file
  void valueField;

  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });

  // Collect relation information for later processing
  collectors.relationFields.add({ fieldConfig, context });
};
