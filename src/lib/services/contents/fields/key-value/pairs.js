import { getField } from '$lib/services/contents/entry/fields';
import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';

/**
 * @import { FlattenedEntryContent, GetFieldArgs } from '$lib/types/private';
 * @import { FieldKeyPath, KeyValueField } from '$lib/types/public';
 */

/**
 * Regular expression to strip the key from a pair’s key path, e.g. `metadata.foo` → `metadata`.
 * The key can be empty, so use `*` instead of `+`.
 */
export const PAIR_KEY_PATH_REGEX = /\.[^.]*$/;

/**
 * Get the configuration of the KeyValue field that the given pair belongs to. A pair is stored
 * under an arbitrary key, e.g. `metadata.foo`, that `getField()` can’t resolve on its own, so the
 * field is looked up by the parent key path instead.
 * @param {GetFieldArgs} args Arguments for the {@link getField} function, with a pair’s key path.
 * @returns {KeyValueField | undefined} Field configuration, or `undefined` if the key path doesn’t
 * belong to a KeyValue field.
 */
export const getKeyValueField = (args) => {
  const { keyPath } = args;

  if (!keyPath.includes('.')) {
    return undefined;
  }

  const fieldConfig = getField({ ...args, keyPath: keyPath.replace(PAIR_KEY_PATH_REGEX, '') });

  return fieldConfig?.widget === 'keyvalue'
    ? /** @type {KeyValueField} */ (fieldConfig)
    : undefined;
};

/**
 * Get key-value pairs from the given flattened content.
 * @param {FlattenedEntryContent} content Flattened content for a locale.
 * @param {FieldKeyPath} keyPath Field key path.
 * @param {object} [options] Options.
 * @param {boolean} [options.live] Whether the content may be mutated after this call, like the
 * draft’s live map, which {@link setPairs} mutates in place. Its key paths are then read as they
 * are right now, rather than from the index kept for a snapshot.
 * @returns {[string, string][]} Key-value pairs.
 */
export const getPairsFromContent = (content, keyPath, { live = true } = {}) => {
  const prefix = `${keyPath}.`;

  return /** @type {[string, string][]} */ (
    getKeysByPrefix(content, prefix, { live }).map((key) => [
      key.slice(prefix.length),
      content[key],
    ])
  );
};

/**
 * Replace the key-value pairs stored in the given flattened content.
 * @param {FlattenedEntryContent} content Flattened content for a locale, modified in place.
 * @param {FieldKeyPath} keyPath Field key path.
 * @param {[string, string][]} pairs Key-value pairs.
 */
export const setPairs = (content, keyPath, pairs) => {
  // Clear the existing pairs first. Unlike other non-primitive fields, a KeyValue field stores no
  // placeholder at its own key path: its keys are arbitrary strings, and `unflatten()` would turn
  // numeric ones into an array. `finalizeContent()` rebuilds the object from the children instead.
  // The content is the draft’s live map, which is mutated right below, so its key paths have to be
  // read as they are right now
  getKeysByPrefix(content, `${keyPath}.`, { live: true }).forEach((_keyPath) => {
    delete content[_keyPath];
  });

  // The editor stores `null` at the field’s own key path while it holds no pairs, so that the
  // field still gets validated. That has to go once there are pairs, or `unflatten()` would let it
  // win over them
  if (pairs.length && content[keyPath] === null) {
    delete content[keyPath];
  }

  pairs.forEach(([key, value]) => {
    content[`${keyPath}.${key}`] = value;
  });
};

/**
 * Put the key-value pairs stored in the given flattened content in the same order as those in the
 * reference content, e.g. the default locale’s. The pairs whose key the reference doesn’t hold go
 * last, in their current order. Only the order changes: no pair is added, removed or given another
 * value.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Flattened content for a locale, modified in place.
 * @param {FlattenedEntryContent} args.referenceContent Flattened content to take the order from.
 * @param {FieldKeyPath} args.keyPath Field key path.
 */
export const alignPairOrder = ({ content, referenceContent, keyPath }) => {
  const pairs = getPairsFromContent(content, keyPath);
  const keys = pairs.map(([key]) => key);

  const referenceKeys = getPairsFromContent(referenceContent, keyPath)
    .map(([key]) => key)
    .filter((key) => keys.includes(key));

  const orderedKeys = [...referenceKeys, ...keys.filter((key) => !referenceKeys.includes(key))];

  // Leave the content alone if the order is already right
  if (orderedKeys.some((key, index) => key !== keys[index])) {
    setPairs(
      content,
      keyPath,
      orderedKeys.map((key) => /** @type {[string, string]} */ (pairs[keys.indexOf(key)])),
    );
  }
};
