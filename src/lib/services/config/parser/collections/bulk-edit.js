import { isObject } from '@sveltia/utils/object';

import { addMessage } from '$lib/services/config/parser/utils/validator';
import { isBulkEditableField } from '$lib/services/contents/collection/entries/bulk-edit/config';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { BulkEditOptions, Field } from '$lib/types/public';
 */

/**
 * Validate the fields named with the `fields` sub-option of the collection’s `bulk_edit` option. A
 * field that doesn’t exist at the top level of the collection, or can’t be edited in bulk, is left
 * out of the bulk editor, which is hard to tell from a working configuration, so it’s reported. The
 * option type is checked against the JSON schema.
 * @param {object} args Arguments.
 * @param {boolean | BulkEditOptions | undefined} args.bulkEdit `bulk_edit` option value.
 * @param {Field[] | undefined} args.fields Collection fields.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkBulkEditFields = ({ bulkEdit, fields = [], context, collectors }) => {
  if (!isObject(bulkEdit) || !Array.isArray(bulkEdit.fields)) {
    return;
  }

  bulkEdit.fields.forEach((name) => {
    const fieldConfig = fields.find((field) => field.name === name);

    if (!fieldConfig) {
      addMessage({
        strKey: 'invalid_bulk_edit_field',
        values: { name: String(name) },
        context,
        collectors,
      });
    } else if (!isBulkEditableField(fieldConfig)) {
      addMessage({
        strKey: 'unsupported_bulk_edit_field',
        values: { name: String(name) },
        context,
        collectors,
      });
    }
  });
};
