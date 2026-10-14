import {
  TEMPLATE_TAG_REGEX,
  TEMPLATE_TAG_REPLACE_REGEX,
} from '$lib/services/common/template/constants';

/**
 * @import { StringTransformation } from '$lib/types/private';
 */

/**
 * Resolve the nested template tags in a transformation argument, e.g. `{{fields.title}}` or
 * `{{fields.first_name}} {{fields.last_name}}`, keeping the text around them.
 * @param {string} value The transformation argument value.
 * @param {(tag: string) => string} resolveTag Function to resolve a nested tag.
 * @returns {string} Resolved value.
 */
const resolveNestedTemplateValues = (value, resolveTag) =>
  value.replaceAll(TEMPLATE_TAG_REPLACE_REGEX, (_match, /** @type {string} */ innerTag) =>
    String(resolveTag(innerTag) ?? ''),
  );

/**
 * Process nested template tags in transformation arguments (e.g., `default('{{fields.title}}')`).
 * This handles nested templates in `default`, `ternary`, and custom transformations that accept
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

    // Handle nested templates in the string arguments of a custom transformation
    const { customArgs } = tf;
    /** @type {(string | number)[] | undefined} */
    let newCustomArgs;

    if (customArgs?.some((arg) => typeof arg === 'string' && TEMPLATE_TAG_REGEX.test(arg))) {
      newCustomArgs = customArgs.map((arg) =>
        typeof arg === 'string' ? resolveNestedTemplateValues(arg, resolveTag) : arg,
      );
    }

    if (!hasChanges && !newCustomArgs) {
      return tf;
    }

    return { ...tf, args: newArgs, ...(newCustomArgs ? { customArgs: newCustomArgs } : {}) };
  });
