import { INNER_TAG_REGEX } from '$lib/services/common/template/constants';

/**
 * @import { StringTransformation } from '$lib/types/private';
 */

/**
 * Process nested template tags in transformation arguments (e.g., `default('{{fields.title}}')`).
 * This handles nested templates in `default`, `ternary`, and other transformations that accept
 * string arguments which may contain template tags.
 * @param {StringTransformation[]} transformations Transformation entries.
 * @param {(tag: string) => string} resolveTag Function to resolve a tag to its value.
 * @returns {StringTransformation[]} Processed transformations with nested templates resolved.
 */
export const processNestedTemplates = (transformations, resolveTag) =>
  transformations.map((tf) => {
    const { defaultValue, truthyValue, falsyValue } = tf.args;
    const newArgs = { ...tf.args };
    let hasChanges = false;

    // Handle nested template in default transformation
    if (defaultValue !== undefined) {
      const { innerTag } = defaultValue.match(INNER_TAG_REGEX)?.groups ?? {};

      if (innerTag !== undefined) {
        newArgs.defaultValue = resolveTag(innerTag);
        hasChanges = true;
      }
    }

    // Handle nested templates in ternary transformation
    if (truthyValue !== undefined) {
      const { innerTag: truthyInnerTag } = truthyValue.match(INNER_TAG_REGEX)?.groups ?? {};

      if (truthyInnerTag !== undefined) {
        newArgs.truthyValue = resolveTag(truthyInnerTag);
        hasChanges = true;
      }
    }

    if (falsyValue !== undefined) {
      const { innerTag: falsyInnerTag } = falsyValue.match(INNER_TAG_REGEX)?.groups ?? {};

      if (falsyInnerTag !== undefined) {
        newArgs.falsyValue = resolveTag(falsyInnerTag);
        hasChanges = true;
      }
    }

    return hasChanges ? { ...tf, args: newArgs } : tf;
  });
