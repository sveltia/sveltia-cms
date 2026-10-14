import { customStringTransformationRegistry } from '$lib/services/api/registries';
import {
  BUILTIN_STRING_TRANSFORMATIONS,
  STRING_TRANSFORMATION_NAME_REGEX,
} from '$lib/services/common/transformations';

/**
 * @import { StringTransformer } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

/**
 * Register a custom string transformation, which can be used in template tags like the built-in
 * ones, e.g. `{{title | reverse}}` or `{{title | wrap('[', ']')}}`, in the contexts where string
 * transformations are supported, such as the `summary` collection option and the Compute field’s
 * `value` option. Registering a transformation with the same name again replaces the previous one.
 * The transformation should be registered before the CMS is initialized, so it’s available when
 * entry summaries and field values are first rendered.
 * @param {string} name Transformation name, which can contain letters, digits and underscores, and
 * cannot start with a digit or be the name of a built-in transformation, such as `upper`.
 * @param {StringTransformer} transform Function that receives the value and a context
 * object containing the `args` given to the transformation and the content `locale`, and returns
 * the transformed string synchronously. If it throws an error or returns a Promise, the value is
 * passed through unchanged, and the first such failure of the function is logged to the console.
 * @throws {TypeError} If `name` is not a valid transformation name or `transform` is not a
 * function.
 * @throws {Error} If `name` is the name of a built-in transformation.
 * @see https://github.com/decaporg/decap-cms/issues/3677
 * @see https://sveltiacms.app/en/docs/api/string-transformations
 */
const registerStringTransformation = (name, transform) => {
  if (typeof name !== 'string' || !STRING_TRANSFORMATION_NAME_REGEX.test(name)) {
    throw new TypeError(
      'The `name` option for `CMS.registerStringTransformation()` must be a string consisting of ' +
        'letters, digits and underscores, not starting with a digit',
    );
  }

  if (BUILTIN_STRING_TRANSFORMATIONS.includes(name)) {
    throw new Error(
      `The string transformation name "${name}" is reserved for a built-in transformation. ` +
        'Choose a different name for your custom transformation.',
    );
  }

  if (typeof transform !== 'function') {
    throw new TypeError(
      'The `transform` option for `CMS.registerStringTransformation()` must be a function',
    );
  }

  customStringTransformationRegistry.set(name, transform);
};

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `register-string-transformation.d.ts` file
export { registerStringTransformation };
