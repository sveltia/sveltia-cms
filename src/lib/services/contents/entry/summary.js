import { locale as appLocale } from '@sveltia/i18n';
import { getDateTimeParts } from '@sveltia/utils/datetime';
import { sanitize } from 'isomorphic-dompurify';
import { parseInline } from 'marked';
import { parseEntities } from 'parse-entities';

import { processNestedTemplates } from '$lib/services/common/template/nested';
import { replaceTemplateTags } from '$lib/services/common/template/tags';
import {
  getFileNameLocaleSuffixes,
  getFileNameParts,
  stripFieldTagPrefix,
} from '$lib/services/common/template/utils';
import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';
import { allEntries } from '$lib/services/contents';
import {
  getIndexFile,
  isCollectionIndexFile,
} from '$lib/services/contents/collection/entries/index-file';
import {
  getCollectionFile,
  getCollectionFileEntry,
  getCollectionFileLabel,
} from '$lib/services/contents/collection/files';
import { getIdentifierFieldName } from '$lib/services/contents/collection/identifier';
import { getField } from '$lib/services/contents/entry/fields';
import { getEntryDirName } from '$lib/services/contents/entry/paths';
import { getFieldDisplayValue } from '$lib/services/contents/entry/values';
import { getOrCreate } from '$lib/services/utils/cache';
import { getCommitAuthorName } from '$lib/services/utils/commit-author';

/**
 * @import {
 * CommitAuthor,
 * Entry,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { RawEntryContent } from '$lib/types/public';
 */

/**
 * @typedef {object} ReplacerSubContext
 * @property {string} slug Entry slug.
 * @property {string} entryPath Entry path.
 * @property {string | undefined} basePath Base path for the entry.
 * @property {RegExp} [fullPathRegEx] Entry collection’s entry path matcher, which tells the
 * `{{dirname}}` tag where the locale folder is.
 * @property {string[]} locales Enabled locales for the entry.
 * @property {string[]} [localeSuffixes] Locale codes that can follow the entry file name, with the
 * `multiple_files` i18n structure.
 * @property {Date | undefined} commitDate Commit date.
 * @property {CommitAuthor | undefined} commitAuthor Commit author.
 */

/**
 * @typedef {object} ReplaceContext
 * @property {FlattenedEntryContent} content Entry content.
 * @property {string} collectionName Collection name.
 * @property {string} [fileName] Collection file name, whose fields the tags refer to. File
 * collection only.
 * @property {boolean} [isIndexFile] Whether the tags refer to the fields of the collection’s index
 * file.
 * @property {ReplacerSubContext} replaceSubContext Context for the `replaceSub` function.
 * @property {InternalLocaleCode} locale Locale of the content, which a field value is displayed
 * and transformed in: a DateTime field value may be written in it.
 * @property {string | undefined} [fallbackSummary] Fallback summary for the entry.
 */

/**
 * @typedef {object} CachedSummary
 * @property {string} summary Formatted summary.
 * @property {number} [generation] {@link entriesGeneration} the summary was formatted in, if it
 * contains a Relation field label and has to be regenerated once other entries change.
 */

/**
 * Regular expression to match an ATX heading line in Markdown, capturing its text. The body is
 * untrusted, so it’s written to match in linear time: the heading text runs to the end of the line
 * in one go, and the trailing spaces and a custom anchor are removed with string operations in
 * {@link getBodyHeader}, as a lazy capture followed by optional suffixes reads the rest of the line
 * again at every character.
 */
const BODY_HEADER_REGEX = /^#+[^\S\n\r\u2028\u2029]+(.*)$/gm;

/**
 * Remove a custom anchor like `{#my-anchor}` at the end of the given heading text.
 * @param {string} text Heading text without leading and trailing whitespace.
 * @returns {string} Heading text without the anchor.
 * @see https://vitepress.dev/guide/markdown#custom-anchors
 */
const removeHeadingAnchor = (text) => {
  if (!text.endsWith('}')) {
    return text;
  }

  // The anchor starts at the first `{#` that follows whitespace and has a name before the last `}`
  for (let index = text.indexOf('{#', 1); index > 0; index = text.indexOf('{#', index + 1)) {
    if (index + 2 >= text.length - 1) {
      break;
    }

    if (/\s/.test(text[index - 1])) {
      return text.slice(0, index).trimEnd();
    }
  }

  return text;
};

/**
 * Find the first ATX heading with text in the given Markdown.
 * @param {string} markdown Markdown string.
 * @returns {string} Heading text without a custom anchor, or an empty string if there is no
 * heading.
 */
const getBodyHeader = (markdown) =>
  markdown
    .matchAll(BODY_HEADER_REGEX)
    .map(([, text]) => removeHeadingAnchor(text.trim()))
    .find((header) => !!header) ?? '';

/**
 * Parse the given entry summary as Markdown and sanitize HTML with a few exceptions if the Markdown
 * option is enabled. Also, parse HTML character references (entities).
 * Without the Markdown option, the references are decoded after sanitizing, so the result can
 * contain markup, e.g. `&lt;img&gt;` becomes `<img>`: it’s only safe as text, never with Svelte’s
 * `@html` tag or `innerHTML`.
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

  // Attributes are dropped, so an entry value cannot restyle the app with `style`, e.g. a title
  // wrapped in `<strong style="position: fixed; inset: 0">` covering the whole page
  str = sanitize(str, {
    ALLOWED_TAGS: allowMarkdown ? ['strong', 'em', 'code'] : [],
    ALLOWED_ATTR: [],
  });

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
    return getBodyHeader(content.body);
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
  const {
    slug,
    entryPath,
    basePath,
    fullPathRegEx,
    locales,
    localeSuffixes,
    commitDate,
    commitAuthor,
  } = context;

  if (tag === 'slug') {
    return slug;
  }

  if (tag === 'locales') {
    return locales.sort((a, b) => a.localeCompare(b)).join(', ');
  }

  if (tag === 'dirname') {
    return getEntryDirName(entryPath, { basePath, fullPathRegEx });
  }

  if (tag === 'filename' || tag === 'extension') {
    return getFileNameParts(entryPath, localeSuffixes)[tag];
  }

  if (tag === 'commit_date') {
    return commitDate ?? '';
  }

  if (tag === 'commit_author') {
    return getCommitAuthorName(commitAuthor);
  }

  return undefined;
};

/**
 * Whether a Relation field label has been resolved since the flag was last reset. Set by
 * {@link replace}, so {@link getEntrySummary} can tell whether the summary it has just formatted
 * depends on other entries.
 */
let relationLabelResolved = false;

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
    fileName,
    isIndexFile,
    replaceSubContext,
    locale,
    fallbackSummary,
  } = context;

  const { value: tag, transformations: parsedTransformations } = parseTransformations(placeholder);
  const keyPath = stripFieldTagPrefix(tag);
  const getFieldArgs = { collectionName, fileName, valueMap, keyPath, isIndexFile };
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
    if (transformations.some(({ method }) => method === 'date' || method === 'ternary')) {
      value = Object.hasOwn(valueMap, keyPath) ? valueMap[keyPath] : undefined;
    } else {
      // A Relation field is displayed with a label taken from the referenced entry
      if (getField(getFieldArgs)?.widget === 'relation') {
        relationLabelResolved = true;
      }

      value = getFieldDisplayValue({ ...getFieldArgs, locale });
    }

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
      locale,
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
 * @type {WeakMap<Entry, WeakMap<InternalCollection, Map<string, CachedSummary>>>}
 */
const summaryCacheMap = new WeakMap();
/**
 * Last seen `allEntries` array, used to detect changes for {@link getEntriesGeneration}.
 * @type {Entry[] | undefined}
 */
let lastAllEntries;
/**
 * Number of times `allEntries` has changed. Recorded with a cached summary containing a Relation
 * field label, so it’s regenerated when the referenced entries change, which does not necessarily
 * replace the referencing entry itself. Other summaries only depend on their own entry, so they
 * survive a change to the rest of the store, such as a save or a remote refresh.
 */
let entriesGeneration = 0;

/**
 * Get the current `allEntries` generation, incrementing it when the store’s array is replaced.
 * @returns {number} Generation number.
 */
const getEntriesGeneration = () => {
  const entries = allEntries.current;

  if (entries !== lastAllEntries) {
    lastAllEntries = entries;
    entriesGeneration += 1;
  }

  return entriesGeneration;
};

/**
 * Get the label and the `summary` template of the collection file or index file the given entry
 * is, which are used in place of the collection’s.
 * @param {InternalCollection} collection Entry’s collection.
 * @param {Entry} entry Entry.
 * @param {string} [fileName] Collection file name. File collection only.
 * @returns {{ collectionFile?: InternalCollectionFile, isIndexFile: boolean, label?: string,
 * template?: string }} The collection file, whether the entry is the index file, and its label and
 * template. The label is `undefined` for a regular entry.
 */
const getOwnSummaryOptions = (collection, entry, fileName) => {
  const collectionFile = fileName ? getCollectionFile(collection, fileName) : undefined;

  if (collectionFile) {
    return {
      collectionFile,
      isIndexFile: false,
      label: getCollectionFileLabel(collectionFile),
      template: collectionFile.summary,
    };
  }

  const isIndexFile = isCollectionIndexFile(collection, entry);
  const { label, summary: template } = (isIndexFile && getIndexFile(collection)) || {};

  return { isIndexFile, label, template };
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
 * @param {string} [options.template] Summary template that overrides the collection’s `summary`
 * option.
 * @param {boolean} [options.useIndexFileLabel] Whether to use the label of the collection’s index
 * file as its summary. Default: `true`.
 * @param {string} [options.fileName] Name of the collection file the entry belongs to. File
 * collection only.
 * @returns {string} Formatted entry summary.
 */
const formatEntrySummary = (
  collection,
  entry,
  {
    locale,
    useTemplate = false,
    allowMarkdown = false,
    template,
    useIndexFileLabel = true,
    fileName,
  } = {},
) => {
  const { _type, name: collectionName } = collection;

  const {
    collectionFile,
    isIndexFile,
    label,
    template: ownTemplate,
  } = getOwnSummaryOptions(collection, entry, fileName);

  const useOwnTemplate = useTemplate && template === undefined && !!ownTemplate;

  // A collection file or index file is labelled unless its own summary template is requested. A
  // given template, such as `nested.summary` for the tree folder labels, doesn’t apply to it
  if ((collectionFile || (isIndexFile && useIndexFileLabel)) && !useOwnTemplate) {
    return /** @type {string} */ (label);
  }

  // A collection file has an i18n configuration of its own
  const { defaultLocale } = (collectionFile ?? collection)._i18n;

  const { _file: { basePath, fullPathRegEx } = {}, summary: collectionSummaryTemplate } =
    _type === 'entry' ? collection : {};

  const identifierField = getIdentifierFieldName(_type === 'entry' ? collection : undefined);
  const summaryTemplate = template ?? ownTemplate ?? collectionSummaryTemplate;
  const { locales, slug, commitDate, commitAuthor } = entry;
  const requestedLocale = locale ?? defaultLocale;

  // An entry may lack the locale, e.g. one only written in another locale
  const contentLocale = Object.hasOwn(locales, requestedLocale)
    ? requestedLocale
    : (Object.keys(locales)[0] ?? requestedLocale);

  const { content = {}, path: entryPath = '' } = locales[contentLocale] ?? {};

  const fallbackSummary =
    getEntrySummaryFromContent(content, { identifierField }) || label || slug.replaceAll('-', ' ');

  if (!useTemplate || !summaryTemplate) {
    return sanitizeEntrySummary(fallbackSummary, { allowMarkdown });
  }

  /** @type {ReplaceContext} */
  const replaceContext = {
    content,
    collectionName,
    fileName: collectionFile?.name,
    isIndexFile,
    replaceSubContext: {
      slug,
      entryPath,
      basePath,
      fullPathRegEx,
      locales: Object.keys(locales),
      localeSuffixes: getFileNameLocaleSuffixes(collectionFile ?? collection),
      commitDate,
      commitAuthor,
    },
    locale: contentLocale,
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
 * @param {string} [options.template] Summary template that overrides the collection’s `summary`
 * option. Used for the folder labels in the tree of nested entries, which have their own
 * `nested.summary` option, and the template columns of the entry list’s table view.
 * @param {boolean} [options.useIndexFileLabel] Whether to use the label of the collection’s index
 * file as its summary, instead of formatting it. Default: `true`. A table view column showing a
 * template, such as `{{filename}}`, formats it for the index file too. With `useTemplate`, the
 * index file’s own `summary` template is used instead of the label if defined.
 * @param {string} [options.fileName] Name of the collection file the entry belongs to. File
 * collection only. The file’s label is returned, or with `useTemplate`, the file’s own `summary`
 * template is formatted with its fields if defined.
 * @returns {string} Formatted entry summary.
 * @see https://decapcms.org/docs/configuration-options/#summary
 * @see https://sveltiacms.app/en/docs/collections/entries/listings#summaries
 */
export const getEntrySummary = (collection, entry, options = {}) => {
  const {
    locale,
    useTemplate = false,
    allowMarkdown = false,
    template,
    useIndexFileLabel = true,
    fileName,
  } = options;

  const optionCache = getOrCreate(
    getOrCreate(summaryCacheMap, entry, () => new WeakMap()),
    collection,
    () => new Map(),
  );

  // The app locale is part of the key because a summary can contain a localized index file label
  // or Relation field label
  const cacheKey = [
    locale ?? '',
    useTemplate ? '1' : '0',
    allowMarkdown ? '1' : '0',
    template ?? '',
    useIndexFileLabel ? '1' : '0',
    fileName ?? '',
    // `Array.join()` turns an unset locale into an empty string
    appLocale.current,
  ].join('\n');

  const generation = getEntriesGeneration();
  const cached = optionCache.get(cacheKey);

  if (cached && (cached.generation === undefined || cached.generation === generation)) {
    return cached.summary;
  }

  // Resolving a Relation field label may format a summary of the referenced entry, so the flag is
  // saved and restored around this one, passing on whether it has been set
  const outerFlag = relationLabelResolved;

  relationLabelResolved = false;

  const summary = formatEntrySummary(collection, entry, options);
  const dependsOnEntries = relationLabelResolved;

  relationLabelResolved = outerFlag || dependsOnEntries;
  optionCache.set(cacheKey, { summary, generation: dependsOnEntries ? generation : undefined });

  return summary;
};

/**
 * Get the summary of a file in a file collection, formatted with the file’s own `summary` template
 * to be displayed in the file list.
 * @param {InternalCollection} collection File collection.
 * @param {string} fileName Collection file name.
 * @returns {string | undefined} Summary as HTML, which can contain Markdown formatting, or
 * `undefined` if the file has no `summary` template or doesn’t exist in the repository yet, so the
 * file label is displayed instead.
 */
export const getCollectionFileSummary = (collection, fileName) => {
  if (!getCollectionFile(collection, fileName)?.summary) {
    return undefined;
  }

  const entry = getCollectionFileEntry(collection.name, fileName);

  return entry
    ? getEntrySummary(collection, entry, { fileName, useTemplate: true, allowMarkdown: true })
    : undefined;
};
