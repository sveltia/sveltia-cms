import { isObject } from '@sveltia/utils/object';

import { addMessage } from '$lib/services/config/parser/utils/validator';

/**
 * @import { FieldParserArgs } from '$lib/types/private';
 * @import { CodeField } from '$lib/types/public';
 */

/**
 * Parse and validate a Code field configuration. The `default` is a string when the field outputs
 * the code only, or an object whose properties are named by the `keys` option, and a mismatch is
 * silently dropped at runtime.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseCodeFieldConfig = ({ config, context, collectors }) => {
  const {
    default: defaultValue,
    output_code_only: outputCodeOnly = false,
    keys = { code: 'code', lang: 'lang' },
  } = /** @type {CodeField} */ (config);

  // A string default is the code in either mode; a value of another type is reported against the
  // JSON schema
  if (!isObject(defaultValue)) {
    return;
  }

  if (outputCodeOnly) {
    addMessage({ strKey: 'code_field_invalid_default_object', context, collectors });

    return;
  }

  const { code, lang } = keys;

  Object.keys(defaultValue)
    .filter((key) => ![code, lang].includes(key))
    .forEach((key) => {
      addMessage({
        strKey: 'code_field_invalid_default_key',
        values: { key, code, lang },
        context,
        collectors,
      });
    });
};
