import { compare } from '@sveltia/utils/string';
import { unflatten } from 'flat';

/**
 * Unflatten a map of dot-notated keys, sorting the keys first so that a parent key always precedes
 * its own children.
 *
 * A map may hold an empty object or array at a key that also has children, as a placeholder for the
 * value the children make up. The `flat` library fills such a placeholder in from the children, but
 * only when it comes first; encountered last, it overwrites everything below it and the children
 * are silently lost. A parent key is a prefix of its children, hence shorter, so sorting puts it
 * first. The comparison is numeric, so indexed keys are ordered `2` before `10` rather than
 * lexicographically.
 * @param {Record<string, any> | null | undefined} map Map of dot-notated keys. A nullish value is
 * passed through, just like the `flat` library does.
 * @returns {Record<string, any>} Unflattened map.
 */
export const unflattenMap = (map) =>
  map
    ? unflatten(Object.fromEntries(Object.entries(map).sort(([a], [b]) => compare(a, b))))
    : unflatten(map);
