import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { FlattenedEntryContent, GetFieldArgs, LocaleValidityMap } from '$lib/types/private';
 * @import { CodeField } from '$lib/types/public';
 */

/**
 * Get the configuration of the Code field that the given key path is the code or language of.
 * Unless the `output_code_only` option is enabled, a Code field stores its value as an object,
 * flattened into e.g. `snippet.code` and `snippet.lang`, which `getField()` can’t resolve on its
 * own, so the field is looked up by the parent key path instead.
 * @param {GetFieldArgs} args Arguments for the {@link getField} function, with the key path of the
 * code or language.
 * @returns {CodeField | undefined} Field configuration, or `undefined` if the key path isn’t the
 * code or language of a Code field.
 */
export const getCodeField = (args) => {
  const { keyPath } = args;
  const index = keyPath.lastIndexOf('.');

  if (index === -1) {
    return undefined;
  }

  const fieldConfig = getField({ ...args, keyPath: keyPath.slice(0, index) });

  if (fieldConfig?.widget !== 'code') {
    return undefined;
  }

  const {
    output_code_only: outputCodeOnly = false,
    keys: outputKeys = { code: 'code', lang: 'lang' },
  } = /** @type {CodeField} */ (fieldConfig);

  return !outputCodeOnly && [outputKeys.code, outputKeys.lang].includes(keyPath.slice(index + 1))
    ? /** @type {CodeField} */ (fieldConfig)
    : undefined;
};

/**
 * Resolve the current value for a code field.
 * @param {object} args Arguments.
 * @param {string} args.keyPath Field key path. It’s the field’s own, not the `.code` or `.lang`
 * sub-key, which is resolved with {@link getCodeField} beforehand.
 * @param {any} args.value Current field value.
 * @param {FlattenedEntryContent} args.valueMap Entry values.
 * @param {CodeField} args.fieldConfig Code field configuration.
 * @param {LocaleValidityMap} args.validities Full validity map.
 * @param {string} args.locale Current locale.
 * @returns {{ skip: boolean, keyPath: string, value: any }} Whether to skip, and the resolved key
 * path and value.
 */
export const resolveCodeField = ({ keyPath, value, valueMap, fieldConfig, validities, locale }) => {
  const {
    output_code_only: outputCodeOnly = false,
    keys: outputKeys = { code: 'code', lang: 'lang' },
  } = fieldConfig;

  // The field is validated only once, whether through its own key path or its sub-keys
  if (keyPath in validities[locale]) {
    return { skip: true, keyPath, value };
  }

  const resolvedValue = !outputCodeOnly ? valueMap[`${keyPath}.${outputKeys.code}`] : value;

  return { skip: false, keyPath, value: resolvedValue };
};
