import { getDateTimeParts } from '@sveltia/utils/datetime';
import { stripSlashes } from '@sveltia/utils/string';
import { sanitize } from 'isomorphic-dompurify';
import { parseInline } from 'marked';
import { parseEntities } from 'parse-entities';
import { applyTransformations } from '$lib/services/contents/entry/transformations';
import { getFieldConfig, getFieldDisplayValue } from '$lib/services/contents/entry/fields';

/**
 * Parse the given entry summary as Markdown and sanitize HTML with a few exceptions if the Markdown
 * option is enabled. Also, parse HTML character references (entities).
 * @param {string} str - Original string.
 * @param {object} [options] - Options.
 * @param {boolean} [options.allowMarkdown] - Whether to allow Markdown and return HTML string.
 * @returns {string} Parsed string.
 */
const sanitizeEntrySummary = (str, { allowMarkdown = false } = {}) => {
  str = /** @type {string} */ (parseInline(str));
  str = sanitize(str, { ALLOWED_TAGS: allowMarkdown ? ['strong', 'em', 'code'] : [] });
  str = parseEntities(str);

  return str.trim();
};

/**
 * Determine an entry summary from the given content. Fields other than `title` should be defined
 * with the `identifier_field` collection option as per the Netlify/Decap CMS document. We also look
 * for the `name` and `label` properties as well as a header in the Markdown `body` as a fallback.
 * @param {FlattenedEntryContent | RawEntryContent} content - Content.
 * @param {object} options - Options.
 * @param {string} [options.identifierField] - Field name to identify the title.
 * @param {boolean} [options.useBody] - Whether to fall back to a header in the Markdown `body`.
 * @returns {string} Entry summary. Can be an empty string if it cannot be determined.
 * @see https://decapcms.org/docs/configuration-options/#identifier_field
 */
export const getEntrySummaryFromContent = (
  content,
  { identifierField = 'title', useBody = true } = {},
) => {
  const idField = [identifierField, 'title', 'name', 'label'].find(
    (fieldName) => typeof content[fieldName] === 'string' && !!content[fieldName].trim(),
  );

  if (idField) {
    return content[idField].trim();
  }

  // Find a header in Markdown, excluding an anchor suffix
  // https://vitepress.dev/guide/markdown#custom-anchors
  if (useBody && typeof content.body === 'string') {
    return content.body.match(/^#+\s+(?<header>.+?)(?:\s+\{#.+?\})?\s*$/m)?.groups?.header ?? '';
  }

  return '';
};

/**
 * Get the given entry’s summary that can be displayed in the entry list and other places. Format it
 * with the summary template if necessary, or simply use the `title` or similar field in the entry.
 * @param {Collection} collection - Entry’s collection.
 * @param {Entry} entry - Entry.
 * @param {object} [options] - Options.
 * @param {LocaleCode} [options.locale] - Target locale. The default locale is used if omitted.
 * @param {boolean} [options.useTemplate] - Whether to use the collection’s `summary` template if
 * available.
 * @param {boolean} [options.allowMarkdown] - Whether to allow Markdown and return HTML string.
 * @returns {string} Formatted entry summary.
 * @see https://decapcms.org/docs/configuration-options/#summary
 */
export const getEntrySummary = (
  collection,
  entry,
  { locale, useTemplate = false, allowMarkdown = false } = {},
) => {
  const {
    name: collectionName,
    identifier_field: identifierField = 'title',
    summary: summaryTemplate,
    _i18n: { defaultLocale },
  } = collection;

  const basePath =
    collection._type === 'entry'
      ? /** @type {EntryCollection} */ (collection)._file.basePath
      : undefined;

  const { locales, slug, commitDate, commitAuthor } = entry;

  const { content = {}, path: entryPath = '' } =
    locales[locale ?? defaultLocale] ?? Object.values(locales)[0] ?? {};

  if (!useTemplate || !summaryTemplate) {
    return sanitizeEntrySummary(
      getEntrySummaryFromContent(content, { identifierField }) || slug.replaceAll('-', ' '),
      { allowMarkdown },
    );
  }

  /**
   * Replacer subroutine.
   * @param {string} tag - Field name or one of special tags.
   * @returns {any} Summary.
   */
  const replaceSub = (tag) => {
    if (tag === 'slug') {
      return slug;
    }

    if (tag === 'dirname') {
      return stripSlashes(entryPath.replace(/[^/]+$/, '').replace(basePath ?? '', ''));
    }

    if (tag === 'filename') {
      return /** @type {string} */ (entryPath.split('/').pop()).split('.').shift();
    }

    if (tag === 'extension') {
      return /** @type {string} */ (entryPath.split('/').pop()).split('.').pop();
    }

    if (tag === 'commit_date') {
      return commitDate ?? '';
    }

    if (tag === 'commit_author') {
      return commitAuthor?.name || commitAuthor?.login || commitAuthor?.email;
    }

    return undefined;
  };

  /**
   * Replacer.
   * @param {string} placeholder - Field name or one of special tags. May contain transformations.
   * @returns {string} Replaced string.
   */
  const replace = (placeholder) => {
    const [tag, ...transformations] = placeholder.split(/\s*\|\s*/);
    const valueMap = content;
    const keyPath = tag.replace(/^fields\./, '');
    /** @type {any} */
    let value = replaceSub(tag);

    if (value === undefined) {
      value = getFieldDisplayValue({ collectionName, valueMap, keyPath, locale: defaultLocale });
    }

    if (value === undefined) {
      return '';
    }

    if (value instanceof Date && !transformations.length) {
      const { year, month, day } = getDateTimeParts({ date: value });

      return `${year}-${month}-${day}`;
    }

    if (transformations.length) {
      value = applyTransformations({
        fieldConfig: getFieldConfig({ collectionName, valueMap, keyPath }),
        value,
        transformations,
      });
    }

    return String(value);
  };

  return sanitizeEntrySummary(
    summaryTemplate.replace(/{{(.+?)}}/g, (_match, placeholder) => replace(placeholder)),
    { allowMarkdown },
  );
};
