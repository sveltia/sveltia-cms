/**
 * Check if the given fields contain a single List widget with the `root` option enabled.
 * @param {Field[]} fields - Field list.
 * @returns {boolean} Result.
 */
export const hasRootListField = (fields) =>
  fields.length === 1 &&
  fields[0].widget === 'list' &&
  /** @type {ListField} */ (fields[0]).root === true;
