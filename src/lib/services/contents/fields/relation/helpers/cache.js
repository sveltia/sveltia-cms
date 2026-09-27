import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { RelationOption } from '$lib/types/private';
 */

/**
 * Cache indexed labels for each cached option array so multi-value relations don’t scan all
 * relation options for every stored value.
 * @type {WeakMap<RelationOption[], Map<any, string>>}
 */
const optionLabelMapCache = new WeakMap();

/**
 * Create or retrieve a value-to-label index for the given relation options.
 * @param {RelationOption[]} options Relation options.
 * @returns {Map<any, string>} Option labels keyed by option value.
 */
export const getOptionLabelMap = (options) =>
  getOrCreate(optionLabelMapCache, options, () => {
    /** @type {Map<any, string>} */
    const labelMap = new Map();

    options.forEach(({ value, label }) => {
      if (!labelMap.has(value)) {
        labelMap.set(value, label);
      }
    });

    return labelMap;
  });

/**
 * `WeakMap` used to assign stable numeric identities to objects for cheap cache key building,
 * avoiding the need to `JSON.stringify` large objects like `fieldConfig` or `refEntries` arrays.
 * @type {WeakMap<object, number>}
 */
const objectIdentityMap = new WeakMap();
let nextObjectId = 0;

/**
 * Get a stable numeric identity for the given object (by reference).
 * @param {object} obj Object.
 * @returns {number} Numeric identity.
 */
export const getObjectId = (obj) =>
  getOrCreate(objectIdentityMap, obj, () => {
    const id = nextObjectId;

    nextObjectId += 1;

    return id;
  });
