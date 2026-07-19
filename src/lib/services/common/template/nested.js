import { INNER_TAG_REGEX } from '$lib/services/common/template/constants';

/**
 * @import { StringTransformation } from '$lib/types/private';
 */

/**
 * Resolve a single nested template value in transformation arguments.
 * @param {string} value The transformation argument value.
 * @param {(tag: string) => string} resolveTag Function to resolve a nested tag.
 * @returns {string} Resolved value.
 */
const resolveNestedTemplateValues = (value, resolveTag) => {
  if (!value.includes('{{')) {
    return value;
  }

  const { innerTag } = value.match(INNER_TAG_REGEX)?.groups ?? {};

  if (innerTag === undefined) {
    return value;
  }

  /* v8 ignore next */
  return String(resolveTag(innerTag) ?? '');
};

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
      const resolvedDefaultValue = resolveNestedTemplateValues(defaultValue, resolveTag);

      if (resolvedDefaultValue !== defaultValue) {
        newArgs.defaultValue = resolvedDefaultValue;
        hasChanges = true;
      }
    }

    // Handle nested templates in ternary transformation
    if (truthyValue !== undefined) {
      const resolvedTruthyValue = resolveNestedTemplateValues(truthyValue, resolveTag);

      if (resolvedTruthyValue !== truthyValue) {
        newArgs.truthyValue = resolvedTruthyValue;
        hasChanges = true;
      }
    }

    if (falsyValue !== undefined) {
      const resolvedFalsyValue = resolveNestedTemplateValues(falsyValue, resolveTag);

      if (resolvedFalsyValue !== falsyValue) {
        newArgs.falsyValue = resolvedFalsyValue;
        hasChanges = true;
      }
    }

    return hasChanges ? { ...tf, args: newArgs } : tf;
  });
