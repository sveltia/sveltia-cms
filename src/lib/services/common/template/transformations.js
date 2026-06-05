import { INNER_TAG_REGEX } from '$lib/services/common/template/constants';
import { DEFAULT_TRANSFORMATION_REGEX } from '$lib/services/common/transformations';

/**
 * @import { ReplaceSubContext } from '$lib/services/common/template/replacers';
 */

/**
 * Processes transformations for a template placeholder.
 * @internal
 * @param {string[]} transformations Array of transformation strings.
 * @param {ReplaceSubContext} replaceSubContext Context for replacement.
 * @param {(tag: string, context: ReplaceSubContext) => any} replaceTemplateTag Replaces tags.
 * @returns {{ transformations: string[], hasDefaultTransformation: boolean }} Result.
 */
export const processTransformations = (transformations, replaceSubContext, replaceTemplateTag) => {
  let hasDefaultTransformation = false;

  transformations.forEach((tf, index) => {
    const { defaultValue } = tf.match(DEFAULT_TRANSFORMATION_REGEX)?.groups ?? {};

    if (defaultValue !== undefined) {
      hasDefaultTransformation = true;

      // Support a template tag for the `default` transformation like
      // `{{fields.slug | default('{{fields.title}}')}}`
      const { innerTag } = defaultValue.match(INNER_TAG_REGEX)?.groups ?? {};

      if (innerTag !== undefined) {
        transformations[index] =
          `default('${replaceTemplateTag(innerTag, replaceSubContext) ?? ''}')`;
      }
    }
  });

  return { transformations, hasDefaultTransformation };
};
