import { flatten } from 'flat';

/**
 * Remove the values of a rich text editor component from the given flattened value map, e.g. the
 * `extraValues` or the validities of a locale in an entry draft. The map is modified in place.
 * @param {Record<string, any> | undefined} valueMap Flattened value map.
 * @param {string} keyPathPrefix Key path prefix of the component, e.g. `body:c12:`.
 */
export const deleteKeysByPrefix = (valueMap, keyPathPrefix) => {
  Object.keys(valueMap ?? {}).forEach((key) => {
    if (key.startsWith(keyPathPrefix)) {
      delete (/** @type {Record<string, any>} */ (valueMap)[key]);
    }
  });
};

/**
 * Flatten the values of a rich text editor component, and prefix the keys with the component’s key
 * path prefix, so they can be stored in the `extraValues` of an entry draft.
 * @param {Record<string, any>} values Component values.
 * @param {string} keyPathPrefix Key path prefix of the component, e.g. `body:c12:`.
 * @returns {Record<string, any>} Flattened value map.
 */
export const flattenWithPrefix = (values, keyPathPrefix) =>
  Object.fromEntries(
    Object.entries(flatten(values)).map(([key, value]) => [`${keyPathPrefix}${key}`, value]),
  );
