import { isObject } from '@sveltia/utils/object';

import { addMessage } from '$lib/services/config/parser/utils/validator';

/**
 * @import { FieldParserArgs } from '$lib/types/private';
 * @import { SelectField, SelectFieldValue } from '$lib/types/public';
 */

/**
 * Parse and validate a Select field configuration. The shape of the `options` list is checked
 * against the JSON schema; what’s checked here is whether the list makes a usable field: one with
 * something to choose from, where each choice can be told apart, and where the `default` is one of
 * the choices rather than a value that can never be selected again once changed.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseSelectFieldConfig = ({ config, context, collectors }) => {
  const { options, default: defaultValue } = /** @type {SelectField} */ (config);

  if (!Array.isArray(options)) {
    return;
  }

  if (!options.length) {
    addMessage({ strKey: 'select_field_no_options', context, collectors });

    return;
  }

  /** @type {SelectFieldValue[]} */
  const values = options.map((option) => (isObject(option) ? option.value : option));

  new Set(values.filter((value, index) => values.indexOf(value) !== index)).forEach((value) => {
    addMessage({
      strKey: 'select_field_duplicate_option',
      values: { value: String(value) },
      context,
      collectors,
    });
  });

  if (defaultValue === undefined) {
    return;
  }

  /** @type {any[]} */ (Array.isArray(defaultValue) ? defaultValue : [defaultValue]).forEach(
    (value) => {
      if (!values.includes(value)) {
        addMessage({
          strKey: 'select_field_invalid_default',
          values: { value: String(value) },
          context,
          collectors,
        });
      }
    },
  );
};
