import { entryDraft } from '$lib/services/contents/draft';
import { getField } from '$lib/services/contents/entry/fields';
import { getPairs } from '$lib/services/contents/fields/key-value/helper';
import { COMPONENT_NAME_PREFIX_REGEX } from '$lib/services/contents/fields/rich-text';

/**
 * @import { Writable } from 'svelte/store';
 * @import {
 * EntryDraft,
 * EntryValidityState,
 * GetFieldArgs,
 * LocaleValidityMap,
 * } from '$lib/types/private';
 */

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
 * @returns {{ skip: boolean, keyPath: string }} Whether to skip, and the resolved key path.
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
  // Given that values for a KeyValue field are flatten into `field.key1`, `field.key2` ...
  // `field.keyN`, we should validate only once against all these values. The key can be
  // empty, so use `.*` in the regex instead of `.+`
  const _keyPath = /** @type {string} */ (keyPath.match(/(.+?)(?:\.[^.]*)?$/)?.[1]);

  const parentFieldConfig = getField({
    ...getFieldArgs,
    keyPath: _keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, ''), // Remove component name prefix
  });

  if (_keyPath in validities[locale] || parentFieldConfig?.widget !== 'keyvalue') {
    return { skip: true, keyPath };
  }

  const _entryDraft = /** @type {Writable<EntryDraft>} */ (entryDraft);
  const pairs = getPairs({ entryDraft: _entryDraft, keyPath: _keyPath, locale });

  if (required && !pairs.length) {
    validity.valueMissing = true;
  } else if (typeof min === 'number' && pairs.length < min) {
    validity.rangeUnderflow = true;
  } else if (typeof max === 'number' && pairs.length > max) {
    validity.rangeOverflow = true;
  }

  return { skip: false, keyPath: _keyPath };
};
