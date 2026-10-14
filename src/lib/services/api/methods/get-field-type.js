import { getFieldTypeDefinition } from '$lib/services/api/field-types';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import { FieldTypeDefinition } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

/**
 * Get the definition of a field type (widget), so that a custom field type can reuse the control
 * and/or preview component of another field type. The components are React components; for a
 * built-in field type, they render the built-in Svelte components internally. Only the built-in
 * field types that work outside the entry editor can be reused: `boolean`, `color`, `datetime`,
 * `map`, `number`, `select`, `string`, `text` and `uuid`. `CMS.getWidget()` is an alias of this
 * method for compatibility with Netlify/Decap CMS.
 * @param {string} name Field type name.
 * @returns {FieldTypeDefinition | undefined} Field type definition, or `undefined` if the field
 * type is not registered or cannot be reused.
 * @throws {TypeError} If `name` is not a non-empty string.
 * @see https://sveltiacms.app/en/docs/api/field-types
 */
const getFieldType = (name) => {
  if (!isNonEmptyString(name)) {
    throw new TypeError('The `name` option for `CMS.getFieldType()` must be a non-empty string');
  }

  return getFieldTypeDefinition(name);
};

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `get-field-type.d.ts` file
export { getFieldType };
