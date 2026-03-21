/**
 * @import { FlattenedEntryContent, LocaleValidityMap } from '$lib/types/private';
 * @import { CodeField } from '$lib/types/public';
 */

/**
 * Resolve the canonical key path and current value for a code field.
 * @param {object} args Arguments.
 * @param {string} args.keyPath Field key path (may be the `.code` or `.lang` sub-key).
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

  const _keyPath = keyPath.match(`(.+)\\.(?:${outputKeys.code}|${outputKeys.lang})$`)?.[1] ?? '';
  const resolvedKeyPath = _keyPath || keyPath;

  if (resolvedKeyPath in validities[locale]) {
    return { skip: true, keyPath: resolvedKeyPath, value };
  }

  const resolvedValue = !outputCodeOnly ? valueMap[`${resolvedKeyPath}.${outputKeys.code}`] : value;

  return { skip: false, keyPath: resolvedKeyPath, value: resolvedValue };
};
