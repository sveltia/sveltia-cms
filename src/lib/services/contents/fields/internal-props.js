/**
 * Prefix of the names of the internal properties the CMS adds to list items and rich text editor
 * component values, like `__sc_item_id`, which are excluded from the output.
 */
export const INTERNAL_PROP_PREFIX = '__sc_';

/**
 * Check whether the given property name is an internal property.
 * @param {string} name Property name, not a key path.
 * @returns {boolean} Result.
 */
export const isInternalPropKey = (name) => name.startsWith(INTERNAL_PROP_PREFIX);
