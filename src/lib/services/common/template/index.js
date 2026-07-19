import { getDateTimeParts } from '@sveltia/utils/datetime';
import { truncate } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { TEMPLATE_TAG_REGEX } from '$lib/services/common/template/constants';
import { replaceTemplatePlaceholder } from '$lib/services/common/template/replacers';
import { cmsConfig } from '$lib/services/config';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { renameIfNeeded } from '$lib/services/utils/file';

/**
 * @import { ReplaceContext } from '$lib/services/common/template/replacers';
 * @import { FillTemplateOptions } from '$lib/types/private';
 */

/**
 * Replace template tags in a string while leaving nested template tags inside transformation
 * arguments untouched. For example, this keeps `default('{{title}}')` from being treated as a
 * separate replacement target when the outer template is processed.
 * @param {string} str The string containing template tags.
 * @param {(match: string, placeholder: string) => string} replacer Replacement callback.
 * @returns {string} Result of the replacements.
 */
export const replaceTemplateTags = (str, replacer) => {
  let result = '';
  let searchIndex = 0;

  while (searchIndex < str.length) {
    const openIndex = str.indexOf('{{', searchIndex);

    if (openIndex === -1) {
      result += str.slice(searchIndex);
      break;
    }

    result += str.slice(searchIndex, openIndex);

    let cursor = openIndex + 2;
    let quoteState = false;

    while (cursor < str.length) {
      const char = str[cursor];
      const nextChar = str[cursor + 1];

      if (char === "'" && !quoteState) {
        quoteState = true;
      } else if (char === "'" && quoteState) {
        quoteState = false;
      }

      if (!quoteState && char === '}' && nextChar === '}') {
        const closeIndex = cursor;
        const hasLeadingQuote = str[openIndex - 1] === "'";
        const hasTrailingQuote = str[closeIndex + 2] === "'";
        const openingDelimiter = str[openIndex - 2];
        const closingDelimiter = str[closeIndex + 3];
        const placeholder = str.slice(openIndex + 2, closeIndex);

        /* v8 ignore next */
        const isNestedTransformationArgument =
          hasLeadingQuote &&
          hasTrailingQuote &&
          ['(', ',', '[', '|'].includes(openingDelimiter ?? '') &&
          [')', ',', ']'].includes(closingDelimiter ?? '');

        if (!placeholder) {
          result += str.slice(openIndex, closeIndex + 2);
        } else if (isNestedTransformationArgument) {
          result += str.slice(openIndex, closeIndex + 2);
        } else {
          result += replacer(str.slice(openIndex, closeIndex + 2), placeholder);
        }

        searchIndex = closeIndex + 2;
        break;
      }

      cursor += 1;
    }

    if (cursor >= str.length) {
      result += str.slice(openIndex);
      break;
    }
  }

  return result;
};

/**
 * Checks if a string contains template tags.
 * @param {string} str The string to check.
 * @returns {boolean} True if the string contains template tags, false otherwise.
 */
export const hasTemplateTags = (str) => TEMPLATE_TAG_REGEX.test(str);

/**
 * Creates existing slugs list for uniqueness validation.
 * @internal
 * @param {string} collectionName Collection name.
 * @param {string | undefined} locale Locale string.
 * @returns {string[]} List of existing slugs.
 */
const getExistingSlugs = (collectionName, locale) =>
  getEntriesByCollection(collectionName)
    .map((e) => (locale ? e.locales[locale]?.slug : e.slug))
    .filter(Boolean);

/**
 * Fills a template string with values from the given options.
 * @param {string} template Template string literal containing tags like `{{title}}`.
 * @param {FillTemplateOptions} options Options.
 * @returns {string} Filled template that can be used for an entry slug, path, etc.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 * @see https://sveltiacms.app/en/docs/collections/entries#managing-entry-slugs
 * @see https://sveltiacms.app/en/docs/media/internal#using-placeholders
 */
export const fillTemplate = (template, options) => {
  const {
    collection,
    content: valueMap,
    currentSlug,
    locale,
    dateTimeParts,
    isIndexFile = false,
  } = options;

  const { _type, name: collectionName } = collection;

  const {
    identifier_field: identifierField = 'title',
    slug_length: legacySlugLength = undefined,
    _file: { basePath } = {},
  } = _type === 'entry' ? collection : {};

  const slugOptions = get(cmsConfig)?.slug;
  // @todo Remove the legacy option prior to the 1.0 release.
  const maxlength = legacySlugLength ?? slugOptions?.maxlength;
  const timeZone = slugOptions?.timezone === 'local' ? undefined : 'UTC';

  /** @type {ReplaceContext} */
  const context = {
    replaceSubContext: {
      ...options,
      dateTimeParts: dateTimeParts ?? getDateTimeParts({ timeZone }),
      identifierField,
      basePath,
    },
    getFieldArgs: { collectionName, keyPath: '', valueMap, isIndexFile },
  };

  // Use a negative lookahead assertion to support nested template tags in transformations like
  // `{{fields.slug | default('{{fields.title}}')}}` or `{{draft | ternary('{{subtitle}}',
  // '{{title}}')}}`
  let slug = replaceTemplateTags(template, (_match, tag) =>
    replaceTemplatePlaceholder(tag, context),
  ).trim();

  // We don’t have to rename it when creating a path with a slug given. Skip truncation because the
  // slug has already been truncated during its own generation, and truncating the entire filled
  // path template (e.g. `{{slug}}/+page`) would break the non-slug parts of the path.
  if (currentSlug) {
    return slug;
  }

  // Truncate a long slug if needed
  if (typeof maxlength === 'number') {
    slug = truncate(slug, maxlength, { ellipsis: '' }).replace(/-$/, '');
  }

  return renameIfNeeded(slug, getExistingSlugs(collectionName, locale));
};
