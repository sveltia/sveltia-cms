import { getField } from '$lib/services/contents/entry/fields';
import { getPairsFromContent } from '$lib/services/contents/fields/key-value/pairs';
import { COMPONENT_NAME_PREFIX_REGEX } from '$lib/services/contents/fields/rich-text';

/**
 * @import {
 * EntryValidityState,
 * GetFieldArgs,
 * LocaleValidityMap,
 * } from '$lib/types/private';
 */

const KEY_PATH_REGEX = /(.+?)(?:\.[^.]*)?$/;

/**
 * Validate a keyvalue field, updating `validity` in place and resolving the canonical key path.
 * @param {object} args Arguments.
 * @param {string} args.keyPath Field key path (may be a sub-key of the keyvalue parent).
 * @param {GetFieldArgs} args.getFieldArgs Base args for {@link getField}.
 * @param {EntryValidityState} args.validity Validity state to update.
 * @param {LocaleValidityMap} args.validities Full validity map.
 * @param {string} args.locale Current locale.
 * @param {boolean} args.required Whether the field is required.
 * @param {string | number} args.min Minimum allowed pairs.
 * @param {string | number} args.max Maximum allowed pairs.
 * @returns {{ skip: boolean, keyPath: string, empty?: boolean }} Whether to skip, the resolved key
 * path, and whether the field holds no pairs at all.
 */
export const validateKeyValueField = ({
  keyPath,
  getFieldArgs,
  validity,
  validities,
  locale,
  required,
  min,
  max,
}) => {
  /**
   * Check whether the given key path points to a KeyValue field.
   * @param {string} _keyPath Key path, which may have a component name prefix.
   * @returns {boolean} Result.
   */
  const isKeyValueField = (_keyPath) =>
    getField({
      ...getFieldArgs,
      keyPath: _keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, ''), // Remove component name prefix
    })?.widget === 'keyvalue';

  // Given that values for a KeyValue field are flatten into `field.key1`, `field.key2` ...
  // `field.keyN`, we should validate only once against all these values. The key can be
  // empty, so use `.*` in the regex instead of `.+`
  let _keyPath = /** @type {string} */ (keyPath.match(KEY_PATH_REGEX)?.[1]);
  let isKeyValue = isKeyValueField(_keyPath);

  // The key path can also be the field’s own, e.g. `obj.meta` holding `null` once all the pairs of
  // a KeyValue field nested in an Object field have been removed
  if (!isKeyValue && isKeyValueField(keyPath)) {
    _keyPath = keyPath;
    isKeyValue = true;
  }

  if (_keyPath in validities[locale] || !isKeyValue) {
    return { skip: true, keyPath };
  }

  // A blank pair, like the one a required field gets as its default value, isn’t saved, so it
  // doesn’t count. A pair with an empty key but a value, which a file can hold, still does
  const pairs = getPairsFromContent(getFieldArgs.valueMap ?? {}, _keyPath).filter(
    ([key, value]) => key.trim() || value,
  );

  if (required && !pairs.length) {
    validity.valueMissing = true;
  } else if (typeof min === 'number' && pairs.length < min) {
    validity.rangeUnderflow = true;
  } else if (typeof max === 'number' && pairs.length > max) {
    validity.rangeOverflow = true;
  }

  return { skip: false, keyPath: _keyPath, empty: !pairs.length };
};
