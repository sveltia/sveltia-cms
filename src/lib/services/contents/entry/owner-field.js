import { getField } from '$lib/services/contents/entry/fields';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { GetFieldArgs, OwnerField } from '$lib/types/private';
 * @import { CodeField, ListField } from '$lib/types/public';
 */

/**
 * Get the field that owns a value stored under a key path without a field configuration of its
 * own: an item of a List field without subfields, e.g. `tags.0`, a KeyValue pair, e.g. `meta.foo`,
 * or the code or language of a Code field that outputs both, e.g. `snippet.code`. Such a value is
 * one part of its field’s value, so it’s copied and reverted along with the field.
 * @param {GetFieldArgs} getFieldArgs Arguments for the `getField` function, with the key path of a
 * value that `getField()` doesn’t resolve.
 * @returns {OwnerField | undefined} Key path and configuration of the owner field, or `undefined`
 * if the value doesn’t belong to such a field.
 */
export const getValueOwnerField = (getFieldArgs) => {
  const { keyPath } = getFieldArgs;
  const index = keyPath.lastIndexOf('.');

  if (index < 0) {
    return undefined;
  }

  // A KeyValue pair key is stored escaped, so the last dot always separates it from the field
  const ownerKeyPath = keyPath.slice(0, index);
  const fieldConfig = getField({ ...getFieldArgs, keyPath: ownerKeyPath });

  if (!fieldConfig) {
    return undefined;
  }

  const { widget: fieldType } = fieldConfig;

  const owned =
    fieldType === 'keyvalue' ||
    (fieldType === 'list' &&
      !getListFieldInfo(/** @type {ListField} */ (fieldConfig)).hasSubFields &&
      isNumeric(keyPath.slice(index + 1))) ||
    (fieldType === 'code' && !(/** @type {CodeField} */ (fieldConfig).output_code_only ?? false));

  return owned ? { keyPath: ownerKeyPath, fieldConfig } : undefined;
};
