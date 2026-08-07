import { locale as appLocale } from '@sveltia/i18n';
import { getDateTimeParts } from '@sveltia/utils/datetime';
import { stripSlashes } from '@sveltia/utils/string';
import { sanitize } from 'isomorphic-dompurify';
import { parseInline } from 'marked';
import { parseEntities } from 'parse-entities';
import { get } from 'svelte/store';

import { replaceTemplateTags } from '$lib/services/common/template';
import { processNestedTemplates } from '$lib/services/common/template/nested';
import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';
import { allEntries } from '$lib/services/contents';
import {
  getIndexFile,
  isCollectionIndexFile,
} from '$lib/services/contents/collection/entries/index-file';
import { getField, getFieldDisplayValue } from '$lib/services/contents/entry/fields';

/**
 * @import {
 * CommitAuthor,
 * Entry,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { RawEntryContent } from '$lib/types/public';
 */

/**
 * @typedef {object} ReplacerSubContext
 * @property {string} slug Entry slug.
 * @property {string} entryPath Entry path.
 * @property {string | undefined} basePath Base path for the entry.
 * @property {string[]} locales Enabled locales for the entry.
 * @property {Date | undefined} commitDate Commit date.
 * @property {CommitAuthor | undefined} commitAuthor Commit author.
 */

/**
 * @typedef {object} ReplaceContext
 * @property {FlattenedEntryContent} content Entry content.
 * @property {string} collectionName Collection name.
 * @property {ReplacerSubContext} replaceSubContext Context for the `replaceSub` function.
 * @property {InternalLocaleCode} defaultLocale Default locale.
 * @property {string | undefined} [fallbackSummary] Fallback summary for the entry.
 */

const BODY_HEADER_REGEX = /^#+\s+(?<header>.+?)(?:\s+\{#.+?\})?\s*$/m;

/**
 * Parse the given entry summary as Markdown and sanitize HTML with a few exceptions if the Markdown
 * option is enabled. Also, parse HTML character references (entities).
 * @param {string} str Original string.
 * @param {object} [options] Options.
 * @param {boolean} [options.allowMarkdown] Whether to allow Markdown and return HTML string.
 * @returns {string} Parsed string.
 */
export const sanitizeEntrySummary = (str, { allowMarkdown = false } = {}) => {
  str = /** @type {string} */ (parseInline(str));

  if (allowMarkdown) {
    str = parseEntities(str);
  }

  str = sanitize(str, { ALLOWED_TAGS: allowMarkdown ? ['strong', 'em', 'code'] : [] });

  if (!allowMarkdown) {
    str = parseEntities(str);
  }

  return str.trim();
};

/**
 * Determine an entry summary from the given content. Fields other than `title` should be defined
 * with the `identifier_field` collection option as per the Netlify/Decap CMS document. We also look
 * for the `name` and `label` properties as well as a header in the Markdown `body` as a fallback.
 * @param {FlattenedEntryContent | RawEntryContent} content Content.
 * @param {object} options Options.
 * @param {string} [options.identifierField] Field name to identify the title.
 * @param {boolean} [options.useBody] Whether to fall back to a header in the Markdown `body`.
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
    return content.body.match(BODY_HEADER_REGEX)?.groups?.header ?? '';
  }

  return '';
};

/**
 * Replacer subroutine.
 * @param {string} tag Field name or one of special tags.
 * @param {ReplacerSubContext} context Context.
 * @returns {string | Date | undefined} Replaced value or `undefined` if the tag is not recognized.
 */
export const replaceSub = (tag, context) => {
  const { slug, entryPath, basePath, locales, commitDate, commitAuthor } = context;

  if (tag === 'slug') {
    return slug;
  }

  if (tag === 'locales') {
    return locales.sort((a, b) => a.localeCompare(b)).join(', ');
  }

  if (tag === 'dirname') {
    let dirPath = entryPath.replace(/[^/]+$/, '');

    if (basePath) {
      // Remove basePath prefix with boundary awareness
      const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;

      if (dirPath.startsWith(prefix)) {
        dirPath = dirPath.slice(prefix.length);
      } else if (dirPath.startsWith(basePath)) {
        dirPath = dirPath.slice(basePath.length);
      }
    }

    return stripSlashes(dirPath);
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
 * @param {string} placeholder Field name or one of special tags. May contain transformations.
 * @param {ReplaceContext} context Context.
 * @returns {string} Replaced string.
 */
export const replace = (placeholder, context) => {
  const {
    content: valueMap,
    collectionName,
    replaceSubContext,
    defaultLocale,
    fallbackSummary,
  } = context;

  const { value: tag, transformations: parsedTransformations } = parseTransformations(placeholder);
  const keyPath = tag.replace(/^fields\./, '');
  const getFieldArgs = { collectionName, valueMap, keyPath };
  let value = replaceSub(tag, replaceSubContext);

  // Process nested templates in transformation arguments
  const transformations = processNestedTemplates(parsedTransformations, (innerTag) =>
    replace(innerTag, context),
  );

  if (value === undefined) {
    // If the `date` transformation is defined, e.g. `{{publish_date | date('YYYY-MM')}}`, use the
    // raw field value from the entry content. Otherwise, use the field display value. This is to
    // avoid applying the transformation to the display value, which leads to unexpected results.
    // Also use raw value for ternary transformations to preserve boolean truthiness.
    value = transformations.some(({ method }) => method === 'date' || method === 'ternary')
      ? valueMap[keyPath]
      : getFieldDisplayValue({ ...getFieldArgs, locale: defaultLocale });

    // If the field is `title` and the value is empty, use the fallback summary if available
    if (keyPath === 'title' && !value) {
      value = fallbackSummary;
    }
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
      fieldConfig: getField({ ...getFieldArgs }),
      value,
      transformations,
      locale: defaultLocale,
    });
  }

  return String(value);
};

/**
 * Cache of formatted entry summaries, keyed by the `Entry` and `InternalCollection` objects, then
 * by the remaining inputs. Object identity is used for the two outer keys so the cache is
 * invalidated for free: the entry store always receives freshly-built objects when entries are
 * loaded or saved, and {@link getCollection} returns a stable object per collection. The entries
 * are garbage-collected along with the objects they belong to.
 * @type {WeakMap<Entry, WeakMap<InternalCollection, Map<string, string>>>}
 */
const summaryCacheMap = new WeakMap();
/**
 * Last seen `allEntries` array, used to detect changes for {@link getEntriesGeneration}.
 * @type {Entry[] | undefined}
 */
let lastAllEntries;
/**
 * Number of times `allEntries` has changed. Folded into the {@link summaryCacheMap} key so that a
 * summary containing a Relation field label is regenerated when the referenced entries change,
 * which does not necessarily replace the referencing entry itself.
 */
let entriesGeneration = 0;

/**
 * Get the current `allEntries` generation, incrementing it when the store’s array is replaced.
 * @returns {number} Generation number.
 */
const getEntriesGeneration = () => {
  const entries = get(allEntries);

  if (entries !== lastAllEntries) {
    lastAllEntries = entries;
    entriesGeneration += 1;
  }

  return entriesGeneration;
};

/**
 * Format the given entry’s summary. This is the uncached implementation of
 * {@link getEntrySummary}.
 * @param {InternalCollection} collection Entry’s collection.
 * @param {Entry} entry Entry.
 * @param {object} [options] Options.
 * @param {InternalLocaleCode} [options.locale] Target locale. The default locale is used if
 * omitted.
 * @param {boolean} [options.useTemplate] Whether to use the collection’s `summary` template if
 * available.
 * @param {boolean} [options.allowMarkdown] Whether to allow Markdown and return HTML string.
 * @returns {string} Formatted entry summary.
 */
const formatEntrySummary = (
  collection,
  entry,
  { locale, useTemplate = false, allowMarkdown = false } = {},
) => {
  if (isCollectionIndexFile(collection, entry)) {
    return /** @type {string} */ (getIndexFile(collection)?.label);
  }

  const {
    _type,
    name: collectionName,
    _i18n: { defaultLocale },
  } = collection;

  const {
    _file: { basePath } = {},
    identifier_field: identifierField = 'title',
    summary: summaryTemplate,
  } = _type === 'entry' ? collection : {};

  const { locales, slug, commitDate, commitAuthor } = entry;

  const { content = {}, path: entryPath = '' } =
    locales[locale ?? defaultLocale] ?? Object.values(locales)[0] ?? {};

  const fallbackSummary =
    getEntrySummaryFromContent(content, { identifierField }) || slug.replaceAll('-', ' ');

  if (!useTemplate || !summaryTemplate) {
    return sanitizeEntrySummary(fallbackSummary, { allowMarkdown });
  }

  /** @type {ReplaceContext} */
  const replaceContext = {
    content,
    collectionName,
    replaceSubContext: {
      slug,
      entryPath,
      basePath,
      locales: Object.keys(locales),
      commitDate,
      commitAuthor,
    },
    defaultLocale,
    fallbackSummary,
  };

  return sanitizeEntrySummary(
    replaceTemplateTags(summaryTemplate, (_match, placeholder) =>
      replace(placeholder, replaceContext),
    ),
    { allowMarkdown },
  );
};

/**
 * Get the given entry’s summary that can be displayed in the entry list and other places. Format it
 * with the summary template if necessary, or simply use the `title` or similar field in the entry.
 *
 * The result is memoized, because formatting always ends with a Markdown parse and an HTML
 * sanitization pass, and the entry list, the search results and the `_summary` sort all call this
 * once per entry — the list cells on every re-render.
 * @param {InternalCollection} collection Entry’s collection.
 * @param {Entry} entry Entry.
 * @param {object} [options] Options.
 * @param {InternalLocaleCode} [options.locale] Target locale. The default locale is used if
 * omitted.
 * @param {boolean} [options.useTemplate] Whether to use the collection’s `summary` template if
 * available.
 * @param {boolean} [options.allowMarkdown] Whether to allow Markdown and return HTML string.
 * @returns {string} Formatted entry summary.
 * @see https://decapcms.org/docs/configuration-options/#summary
 * @see https://sveltiacms.app/en/docs/collections/entries#summaries
 */
export const getEntrySummary = (collection, entry, options = {}) => {
  const { locale, useTemplate = false, allowMarkdown = false } = options;
  let collectionCache = summaryCacheMap.get(entry);

  if (!collectionCache) {
    collectionCache = new WeakMap();
    summaryCacheMap.set(entry, collectionCache);
  }

  let optionCache = collectionCache.get(collection);

  if (!optionCache) {
    optionCache = new Map();
    collectionCache.set(collection, optionCache);
  }

  // The app locale is part of the key because a summary can contain a localized index file label
  // or Relation field label
  const cacheKey = [
    locale ?? '',
    useTemplate ? '1' : '0',
    allowMarkdown ? '1' : '0',
    // `Array.join()` turns an unset locale into an empty string
    appLocale.current,
    getEntriesGeneration(),
  ].join('\n');

  const cached = optionCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const summary = formatEntrySummary(collection, entry, options);

  optionCache.set(cacheKey, summary);

  return summary;
};
