import { generateUUID } from '@sveltia/utils/crypto';

import { slugify } from '$lib/services/common/slug';
import { UUID_TYPES } from '$lib/services/common/template/constants';
import {
  handleDateTimeTag,
  handleFilePathTag,
  handleSlugTag,
  handleUuidTag,
} from '$lib/services/common/template/handlers';
import { processNestedTemplates } from '$lib/services/common/template/nested';
import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';
import { getField } from '$lib/services/contents/entry/fields';
import { sanitizePath } from '$lib/services/utils/file';

/**
 * @import { FillTemplateOptions, GetFieldArgs } from '$lib/types/private';
 */

/**
 * @typedef {object} ReplaceSubContextBase
 * @property {string} identifierField Field name to identify the title.
 * @property {string | undefined} basePath Base path for the entry file.
 */

/**
 * @typedef {FillTemplateOptions & ReplaceSubContextBase} ReplaceSubContext
 */

/**
 * @typedef {object} ReplaceContext
 * @property {ReplaceSubContext} replaceSubContext Context for `replaceSub`.
 * @property {GetFieldArgs} getFieldArgs Arguments for `getField`.
 */

/**
 * Get a random value, reusing the one generated earlier for the same key if the context carries a
 * cache of them. A new entry’s slug is filled while it’s being edited to show what it will be, so a
 * random ID has to stay the same from one fill to the next, and until the entry is saved.
 * @param {ReplaceSubContext} context Replacement context.
 * @param {string} key What the value stands for, e.g. a tag in a locale.
 * @param {() => string} generate Function to generate a new value.
 * @returns {string} Value.
 */
const getRandomValue = ({ randomValues }, key, generate) => {
  if (!randomValues) {
    return generate();
  }

  if (!randomValues.has(key)) {
    randomValues.set(key, generate());
  }

  return /** @type {string} */ (randomValues.get(key));
};

/**
 * Template tag replacer subroutine.
 * @param {string} tag Field name or special tag.
 * @param {ReplaceSubContext} context Replacement context.
 * @returns {any} Replaced value.
 */
export const replaceTemplateTag = (tag, context) => {
  const { type, content, entryFilePath, locale, dateTimeParts, basePath } = context;
  // Handle date-time fields. Parts are pre-calculated in `fillTemplate` to avoid redundant
  // calculations for multiple date-time tags in the same template.
  const _dateTimeParts = /** @type {Record<string, string>} */ (dateTimeParts);
  const dateTimeValue = handleDateTimeTag(tag, _dateTimeParts);

  if (dateTimeValue !== undefined) {
    return dateTimeValue;
  }

  // Handle slug tag
  const slugValue = handleSlugTag(tag, context);

  if (slugValue !== undefined) {
    return slugValue;
  }

  // Handle UUID tags
  if (Object.hasOwn(UUID_TYPES, tag)) {
    return getRandomValue(
      context,
      `${locale}:${tag}`,
      () => /** @type {string} */ (handleUuidTag(tag)),
    );
  }

  // Handle locale tag for preview path
  if (type === 'preview_path' && tag === 'locale') {
    return locale;
  }

  // Handle file path related tags
  if (type === 'preview_path' || type === 'media_folder') {
    const filePathValue = handleFilePathTag(tag, entryFilePath, basePath);

    if (filePathValue !== undefined) {
      return filePathValue;
    }

    // `{{fields.*}}` tags are supported in the preview path template, but not in the media folder
    // path template, so we return `undefined` instead of the field value there to avoid generating
    // invalid paths.
    if (type === 'media_folder') {
      return undefined;
    }
  }

  // Handle field values
  return content[tag.replace(/^fields\./, '')];
};

/**
 * Template placeholder replacer.
 * @param {string} placeholder Field name or one of special tags. May contain transformations.
 * @param {ReplaceContext} context Context for replacement.
 * @returns {string} Replaced string.
 */
export const replaceTemplatePlaceholder = (placeholder, context) => {
  const { replaceSubContext, getFieldArgs } = context;
  const { value: tag, transformations: parsedTransformations } = parseTransformations(placeholder);
  let value = replaceTemplateTag(tag, replaceSubContext);

  // Process nested templates in transformation arguments
  const transformations = processNestedTemplates(parsedTransformations, (innerTag) =>
    String(replaceTemplateTag(innerTag, replaceSubContext) ?? ''),
  );

  // Fall back with a random ID unless the `default` transformation is defined
  const hasDefaultTransformation = parsedTransformations.some(
    (tf) => tf.args.defaultValue !== undefined,
  );

  const hasComplexNestedTemplateArgs = parsedTransformations.some((tf) =>
    [tf.args.defaultValue, tf.args.truthyValue, tf.args.falsyValue].some(
      (arg) => typeof arg === 'string' && arg.includes('{{') && !/^{{[^{}]+}}$/.test(arg),
    ),
  );

  const { type, locale } = replaceSubContext;

  // A random fallback keeps generated slugs and paths unique, but a `preview_path` is recomputed on
  // every render and its result feeds a URL that an effect watches, so a value that changes on each
  // pass sends the entry editor into an infinite render loop. There is nothing sensible to put in a
  // preview URL for a tag that resolves to nothing anyway, so give up on the path instead and let
  // `getPreviewPath()` render no link at all.
  // @see https://github.com/sveltia/sveltia-cms/issues/943
  /**
   * Give up on a preview path whose tag resolves to nothing, so the caller can drop the link
   * instead of building a URL around a value that changes on every render.
   * @throws {Error} If the template is a `preview_path`.
   */
  const bailOnUnresolvableTag = () => {
    if (type === 'preview_path') {
      throw new Error(`Unresolvable template tag in preview path: ${tag}`);
    }
  };

  if (value === undefined && !hasDefaultTransformation) {
    bailOnUnresolvableTag();

    return getRandomValue(replaceSubContext, `${locale}:fallback:${placeholder}`, () =>
      generateUUID('short'),
    );
  }

  if (
    (value === undefined || value === '') &&
    hasDefaultTransformation &&
    hasComplexNestedTemplateArgs
  ) {
    bailOnUnresolvableTag();

    return getRandomValue(
      replaceSubContext,
      `${locale}:fallback:${placeholder}`,
      () => `${generateUUID('short')}-${generateUUID('short')}`,
    );
  }

  if (transformations.length) {
    value = applyTransformations({
      fieldConfig: getField({ ...getFieldArgs, keyPath: tag }),
      value,
      transformations,
      locale,
    });
  }

  // Sanitize path traversal attempts first by removing `.` and `..` segments to prevent writing
  // outside the intended directory structure. This must happen before slugification to ensure that
  // inputs like `../foo` don’t become `..-foo` (with `/` converted to `-`).
  value = sanitizePath(String(value));

  // Return the value as-is when generating the preview path or media folder path
  if (type) {
    return value;
  }

  // Slugify the value for a slug or filename. Don’t limit the length here; it will be handled later
  // in `fillTemplate`. A value that leaves nothing, e.g. an empty field, falls back to a random ID,
  // which is reused like the other random values
  return (
    slugify(value, { locale, maxLength: Infinity, fallback: false }) ||
    getRandomValue(replaceSubContext, `${locale}:fallback:${placeholder}`, () =>
      generateUUID('short'),
    )
  );
};
