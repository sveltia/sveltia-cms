/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { getMediaFieldSource } from '$lib/services/assets/media-field';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry/collections';
import { getField } from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES, RICH_TEXT_FIELD_TYPES } from '$lib/services/contents/fields';
import { getValueFormat } from '$lib/services/contents/fields/rich-text';
import {
  MEDIA_TAG_REGEX,
  MEDIA_TAG_SELECTOR,
  MEDIA_URL_ATTRIBUTES,
  parseSrcset,
  stringifySrcset,
} from '$lib/services/contents/fields/rich-text/previews/media-urls';

/**
 * @import {
 * Asset,
 * AssetReference,
 * Entry,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * MarkdownField,
 * RichTextField,
 * RichTextValueFormat,
 * } from '$lib/types/public';
 */

/**
 * Regular expression to match `![alt](src "title")`, capturing the source. The alt text runs up to
 * the first `](`, so it can contain brackets, and the source up to the first `)` or an optional
 * double-quoted title, which can contain parentheses and escaped quotes.
 *
 * The pattern runs on untrusted Markdown, so it’s written to match in linear time. Every part can
 * only be matched one way, and neither the alt text nor the source can contain `![`, so a failed
 * match at one `![` doesn’t read the text after the next one again. A title is only looked for
 * right after the source’s last non-space character, and it can’t contain an unescaped quote, so
 * each quote is read as the start of a title at most once. An image nested in the alt text or
 * source of an unclosed one is matched on its own instead.
 */
export const MARKDOWN_IMAGE_REGEX =
  /!\[(?:[^\]\n!]|!(?!\[)|\](?!\())*\]\(((?:[^\n!)]|!(?!\[))+?)(?:(?<!\s)\s+"(?:[^"\\\n]|\\.)*")?\)/g;

/**
 * Pattern matching the start tag of a media element, e.g. `<img src="a.png">` or `<video
 * poster="a.jpg">`, written as raw HTML in a Markdown body. Attribute values can be quoted with
 * either kind of quotes, and contain `>` when quoted.
 *
 * The pattern runs on untrusted Markdown, so it’s written to match in linear time: neither an
 * attribute value nor anything else in the tag can contain `<`, so a failed match at one `<`
 * doesn’t read the text after the next one again. A tag with `<` in an attribute value, as in
 * `alt="a<b"`, is missed, which is rare enough.
 */
const MEDIA_START_TAG_PATTERN = `<(?:${Object.keys(MEDIA_URL_ATTRIBUTES).join('|')})(?=[\\s/>])(?:[^<>"']|"[^"<]*"|'[^'<]*')*>`;

/**
 * Regular expression to match either a Markdown image, capturing its source as the first group, or
 * the start tag of a media element written as raw HTML, which Markdown allows, captured as the
 * second group. Both kinds are displayed in the preview, so both refer to the files.
 */
export const MARKDOWN_MEDIA_REGEX = new RegExp(
  `${MARKDOWN_IMAGE_REGEX.source}|(${MEDIA_START_TAG_PATTERN})`,
  'gi',
);

/**
 * Global version of `MEDIA_TAG_REGEX`, to count the media tags in a value.
 */
const GLOBAL_MEDIA_TAG_REGEX = new RegExp(MEDIA_TAG_REGEX, 'gi');

/**
 * Function called for each media URL found in a value, returning a new URL to replace it with,
 * `null` to remove it, or `undefined` to leave it as is.
 * @typedef {(url: string) => string | null | undefined} MediaURLCallback
 */

/**
 * Parse an HTML fragment into the content of a `<template>` element, which is inert: unlike an
 * element in the document, it doesn’t load the media or run the scripts and event handlers found in
 * the HTML, which comes from untrusted field values.
 * @param {string} value HTML.
 * @returns {HTMLTemplateElement} Template holding the parsed nodes.
 */
export const parseHTMLFragment = (value) => {
  const template = document.createElement('template');

  template.innerHTML = value;

  return template;
};

/**
 * Get the media elements in a parsed HTML fragment, in document order.
 * @param {HTMLTemplateElement} template Template holding the parsed nodes.
 * @returns {Element[]} Elements.
 */
export const getMediaElements = (template) => [
  ...template.content.querySelectorAll(MEDIA_TAG_SELECTOR),
];

/**
 * Pass each URL in the URL attributes of a media element to the given callback, e.g. an image
 * `src`, a video `poster` or each URL in a `srcset`, and update the attributes with the result. An
 * attribute left with no URL is removed. The attributes are read with the character references
 * decoded, e.g. `a&amp;b.jpg` as `a&b.jpg`, the same as the file name they refer to. An empty URL
 * is skipped.
 * @param {Element} element Media element.
 * @param {MediaURLCallback} callback Callback.
 * @returns {boolean} Whether any attribute has been changed.
 */
export const updateMediaElementURLs = (element, callback) => {
  let updated = false;

  MEDIA_URL_ATTRIBUTES[element.localName].forEach((name) => {
    const value = element.getAttribute(name);

    if (!value) {
      return;
    }

    if (name !== 'srcset') {
      const url = callback(value);

      if (url === null) {
        element.removeAttribute(name);
        updated = true;
      } else if (url !== undefined && url !== value) {
        element.setAttribute(name, url);
        updated = true;
      }

      return;
    }

    let changed = false;

    const candidates = parseSrcset(value).flatMap((candidate) => {
      const url = callback(candidate.url);

      if (url === null) {
        changed = true;

        return [];
      }

      if (url !== undefined && url !== candidate.url) {
        changed = true;

        return [{ ...candidate, url }];
      }

      return [candidate];
    });

    if (changed) {
      if (candidates.length) {
        element.setAttribute(name, stringifySrcset(candidates));
      } else {
        element.removeAttribute(name);
      }

      updated = true;
    }
  });

  return updated;
};

/**
 * Parse the start tag of a media element, as matched by {@link MARKDOWN_MEDIA_REGEX}.
 * @param {string} tag Start tag.
 * @returns {Element} Element, without content.
 */
export const parseMediaStartTag = (tag) =>
  /** @type {Element} */ (parseHTMLFragment(tag).content.firstElementChild);

/**
 * Serialize the start tag of an element parsed with {@link parseMediaStartTag}. The serialization
 * escapes the attribute values as needed, but may differ from the original tag in formatting, e.g.
 * the quotes around attribute values.
 * @param {Element} element Element, without content.
 * @returns {string} Start tag.
 */
export const serializeStartTag = (element) => {
  const { outerHTML } = element;
  const endTag = `</${element.localName}>`;

  // A void element like `<img>` has no end tag
  return outerHTML.endsWith(endTag) ? outerHTML.slice(0, -endTag.length) : outerHTML;
};

/**
 * Check if a media start tag matched by {@link MARKDOWN_MEDIA_REGEX} in Markdown sits inside
 * another tag, e.g. in an attribute value as in `<a title='<img src="a.png">'>`, where it’s text
 * rather than an element. Such a tag isn’t a reference, and must not be serialized again either, as
 * that may change its quotes and break out of the attribute value it’s in.
 * @param {string} value Markdown.
 * @param {number} index Position of the tag.
 * @returns {boolean} Result.
 */
export const isInsideTag = (value, index) => {
  const start = value.lastIndexOf('<', index - 1);

  // A `<` not followed by a letter, as in `a < b`, doesn’t start a tag
  return (
    index > 0 && start > value.lastIndexOf('>', index - 1) && /[a-z]/i.test(value[start + 1] ?? '')
  );
};

/**
 * Pass each media URL in a Markdown body to the given callback, and replace it with the result: the
 * source of a Markdown image, or a URL attribute of a media element written as raw HTML. Only the
 * URL within each image or tag is replaced, so the same file name mentioned anywhere else in the
 * text, or a source whose name contains another’s, e.g. `hero-image.png` for `image.png`, isn’t
 * hit. A tag is serialized again only if one of its URLs is replaced.
 * @param {string} value Markdown body.
 * @param {MediaURLCallback} callback Callback. Removing a URL isn’t supported here, so `null`
 * leaves it as is.
 * @returns {string} New body.
 */
const updateMarkdownMediaURLs = (value, callback) =>
  value.replace(
    MARKDOWN_MEDIA_REGEX,
    (
      markup,
      /** @type {string | undefined} */ src,
      /** @type {string | undefined} */ tag,
      /** @type {number} */ offset,
    ) => {
      if (tag !== undefined) {
        if (isInsideTag(value, offset)) {
          return markup;
        }

        const element = parseMediaStartTag(tag);

        return updateMediaElementURLs(element, (url) => callback(url) ?? undefined)
          ? serializeStartTag(element)
          : markup;
      }

      const source = /** @type {string} */ (src);
      const url = callback(source);

      if (typeof url !== 'string') {
        return markup;
      }

      // The source comes right after the first `](`, as the alt text is matched lazily
      const start = markup.indexOf('](') + 2;

      return `${markup.slice(0, start)}${url}${markup.slice(start + source.length)}`;
    },
  );

/**
 * Pass each media URL in an HTML body to the given callback, and replace it with the result. The
 * HTML is parsed rather than matched with a regular expression, so a tag in a comment, an attribute
 * value or a `<script>` element isn’t taken for a media element. The result is serialized again,
 * so a new URL is escaped as needed, and the same file name mentioned anywhere else in the HTML,
 * e.g. in a link, isn’t hit. The serialization may differ from the original in formatting, e.g. the
 * quotes around attribute values, so the original is returned as is if no URL is replaced.
 * @param {string} value HTML body.
 * @param {MediaURLCallback} callback Callback. A URL can also be removed.
 * @returns {string} New body.
 */
const updateHTMLMediaURLs = (value, callback) => {
  // Avoid parsing the HTML if there’s no media element
  if (!MEDIA_TAG_REGEX.test(value)) {
    return value;
  }

  const template = parseHTMLFragment(value);
  let updated = false;

  getMediaElements(template).forEach((element) => {
    updated = updateMediaElementURLs(element, callback) || updated;
  });

  return updated ? template.innerHTML : value;
};

/**
 * Pass each media URL in a Markdown or RichText field value to the given callback, and replace it
 * with the result. See {@link MARKDOWN_MEDIA_REGEX} and `MEDIA_URL_ATTRIBUTES` for what’s a media
 * URL.
 * @param {string} value Field value.
 * @param {RichTextValueFormat} format Value format, as returned by `getValueFormat()`.
 * @param {MediaURLCallback} callback Callback.
 * @returns {string} New value, or the original one if nothing is replaced.
 */
export const updateRichTextMediaURLs = (value, format, callback) =>
  format === 'html'
    ? updateHTMLMediaURLs(value, callback)
    : updateMarkdownMediaURLs(value, callback);

/**
 * Get the media URLs in a Markdown or RichText field value, without duplicates.
 * @param {string} value Field value.
 * @param {RichTextValueFormat} format Value format, as returned by `getValueFormat()`.
 * @returns {string[]} URLs, in the order found.
 */
export const getRichTextMediaSources = (value, format) => {
  /** @type {Set<string>} */
  const sources = new Set();

  updateRichTextMediaURLs(value, format, (url) => {
    sources.add(url);

    return undefined;
  });

  return [...sources];
};

/**
 * Replace the media URLs in a Markdown or RichText field value.
 * @param {string} value Field value.
 * @param {Map<string, string | undefined>} newSources New URLs keyed by the current ones, as
 * returned by {@link getRichTextMediaSources}. A URL that’s missing or mapped to `undefined` is
 * left as is.
 * @param {RichTextValueFormat} format Value format, as returned by `getValueFormat()`.
 * @returns {string} New value.
 */
export const replaceRichTextMediaSources = (value, newSources, format) =>
  [...newSources.values()].some((newSource) => newSource !== undefined)
    ? updateRichTextMediaURLs(value, format, (url) => newSources.get(url))
    : value;

/**
 * @typedef {object} AssetReferenceTarget
 * @property {string} [url] Asset’s public, external or blob URL. A value holding the URL as is
 * refers to the asset, except for a blob URL, which a value can only refer to through the asset it
 * resolves to. Required unless {@link AssetReferenceTarget.asset} is given.
 * @property {Asset} [asset] Asset without a URL to compare values with, as in an entry-relative
 * folder. A value refers to it when it resolves to the asset, which doesn’t require the asset to
 * have been loaded, unlike a blob URL.
 * @property {string | ((src: string) => string | undefined)} [newURL] New URL to replace the
 * references with, or a function returning it from the reference being replaced, for a reference
 * whose form depends on the entry holding it, like a path relative to the entry.
 */

/**
 * @typedef {object} AssetReferenceMatcher
 * @property {AssetReferenceTarget[]} targets Targets, in the order given.
 * @property {Map<string, number[]>} byURL Indexes of the targets whose URL a value is compared
 * with as is.
 * @property {Map<string, number[]>} byBlobURL Indexes of the targets whose blob URL is compared
 * with that of the asset a value resolves to.
 * @property {Map<string, number[]>} byPath Indexes of the targets whose asset’s path is compared
 * with that of the asset a value resolves to.
 * @property {boolean} resolves Whether a value has to be resolved to an asset for any target,
 * which rules out telling a value that can’t refer to the assets from its text alone.
 */

/**
 * Get the given asset URL in the form it’s stored in a field value, without the site’s base URL.
 * @param {string} url Asset’s public, external or blob URL.
 * @returns {string} URL to compare values with.
 */
export const getComparableAssetURL = (url) => {
  const baseURL = cmsConfig.current?._baseURL;

  return baseURL && !url.startsWith('blob:') ? url.replace(baseURL, '') : url;
};

/**
 * Index the given targets, so that a value can be compared with all of them at once.
 * @param {AssetReferenceTarget[]} targets Targets, whose URLs are already comparable, as returned
 * by {@link getComparableAssetURL}.
 * @returns {AssetReferenceMatcher} Matcher.
 */
const createMatcher = (targets) => {
  /** @type {AssetReferenceMatcher} */
  const matcher = {
    targets,
    byURL: new Map(),
    byBlobURL: new Map(),
    byPath: new Map(),
    resolves: false,
  };

  targets.forEach(({ url, asset }, index) => {
    const [map, key] = asset
      ? [matcher.byPath, asset.path]
      : /** @type {string} */ (url).startsWith('blob:')
        ? [matcher.byBlobURL, /** @type {string} */ (url)]
        : [matcher.byURL, /** @type {string} */ (url)];

    map.set(key, [...(map.get(key) ?? []), index]);
  });

  matcher.resolves = !!(matcher.byBlobURL.size || matcher.byPath.size);

  return matcher;
};

/**
 * Get the targets the given field value or image source refers to.
 * @param {AssetReferenceMatcher} matcher Matcher.
 * @param {string} src Field value or image source found in it.
 * @param {object} context Context to resolve the value to an asset with.
 * @param {Entry} context.entry Entry.
 * @param {string} context.collectionName Collection name.
 * @param {string} [context.fileName] Collection file name.
 * @param {InternalLocaleCode} [context.locale] Locale the value is found in, which an
 * entry-relative path is relative to.
 * @returns {number[]} Indexes of the targets.
 */
const getMatchingTargets = (matcher, src, { entry, collectionName, fileName, locale }) => {
  const indexes = matcher.byURL.get(src) ?? [];

  if (!matcher.resolves) {
    return indexes;
  }

  // Resolve the value to its asset without loading it. The asset’s blob URL is created once and
  // kept on the asset object, so only the asset being looked up can hold the given one — and
  // there’s no need to download every other asset the entries reference just to compare URLs
  const { url, asset } =
    getMediaFieldSource({ entry, collectionName, fileName, locale, value: src }) ?? {};

  const blobURL = url ?? asset?.blobURL;

  return [
    ...indexes,
    ...((blobURL !== undefined && matcher.byBlobURL.get(blobURL)) || []),
    ...((asset && matcher.byPath.get(asset.path)) || []),
  ];
};

/**
 * Get the new URL to replace a reference to the given targets with.
 * @param {AssetReferenceMatcher} matcher Matcher.
 * @param {number[]} indexes Indexes of the targets referred to.
 * @param {string} src Reference being replaced.
 * @returns {string | undefined} New URL, if any.
 */
const getNewURL = (matcher, indexes, src) =>
  indexes
    .map((index) => {
      const { newURL } = matcher.targets[index];

      return typeof newURL === 'function' ? newURL(src) : newURL;
    })
    .find(Boolean);

/**
 * Check if the given value may refer to any of the targets, from its text alone. A value refers to
 * a target either as a whole, in a media field, or as a media URL in a Markdown or HTML body, so a
 * value that’s neither can be skipped before the costly field lookup. The format of a body isn’t
 * known until the field is, so it’s read as Markdown, which finds the media tags of HTML as well,
 * and only parsed as HTML if a tag is missed, e.g. with `<` in an attribute value.
 * @param {AssetReferenceMatcher} matcher Matcher, which must not need to resolve values.
 * @param {string} value Field value.
 * @returns {boolean} Result.
 */
const mayReferToTargets = (matcher, value) => {
  if (matcher.byURL.has(value)) {
    return true;
  }

  if (!value.includes('![') && !MEDIA_TAG_REGEX.test(value)) {
    return false;
  }

  /**
   * Check if any of the given media URLs refers to a target.
   * @param {string[]} sources URLs.
   * @returns {boolean} Result.
   */
  const hasTarget = (sources) => sources.some((src) => matcher.byURL.has(src));

  if (hasTarget(getRichTextMediaSources(value, 'markdown'))) {
    return true;
  }

  const tagCount = [...value.matchAll(MARKDOWN_MEDIA_REGEX)].filter(([, , tag]) => tag).length;

  return (
    (value.match(GLOBAL_MEDIA_TAG_REGEX)?.length ?? 0) > tagCount &&
    hasTarget(getRichTextMediaSources(value, 'html'))
  );
};

/**
 * Find the targets the given field refers to, and replace the references if the targets have a new
 * URL.
 * @param {object} args Arguments.
 * @param {AssetReferenceMatcher} args.matcher Matcher.
 * @param {string} args.collectionName Collection name.
 * @param {Entry} args.entry Entry.
 * @param {FlattenedEntryContent} args.content Value map for the collection. This will be modified
 * if a reference is replaced.
 * @param {FieldKeyPath} args.keyPath Key path of the value in the collection.
 * @param {string} args.value Value of the field.
 * @param {boolean} args.isIndexFile Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File collection only.
 * @param {InternalLocaleCode} args.locale Locale the value is found in.
 * @returns {{ indexes: Set<number>, field?: Field }} Indexes of the targets found, and the field
 * config, unless the field isn’t configured.
 */
const matchField = ({
  matcher,
  collectionName,
  entry,
  content,
  keyPath,
  value,
  isIndexFile,
  collectionFile,
  locale,
}) => {
  /** @type {Set<number>} */
  const indexes = new Set();
  const fileName = collectionFile?.name;
  const field = getField({ collectionName, fileName, valueMap: content, keyPath, isIndexFile });

  if (!field) {
    return { indexes };
  }

  const { widget: fieldType = 'string' } = field;
  const context = { entry, collectionName, fileName, locale };

  if (MEDIA_FIELD_TYPES.includes(fieldType)) {
    const matched = getMatchingTargets(matcher, value, context);
    const newURL = getNewURL(matcher, matched, value);

    matched.forEach((index) => indexes.add(index));

    if (newURL) {
      content[keyPath] = newURL;
    }

    return { indexes, field };
  }

  // Search media in a Markdown or HTML body
  if (RICH_TEXT_FIELD_TYPES.includes(fieldType)) {
    let replacing = false;

    // Swap the URL within each matched image or tag only, rather than its first occurrence in the
    // text, which can be a link to the same file, the alt text, or the new URL written by a
    // previous replacement. The new value is built from the original one, so doing this again,
    // once for each collection the entry belongs to, gives the same result
    const replaced = updateRichTextMediaURLs(
      value,
      getValueFormat(/** @type {MarkdownField | RichTextField} */ (field)),
      (src) => {
        const matched = getMatchingTargets(matcher, src, context);

        if (!matched.length) {
          return undefined;
        }

        const newURL = getNewURL(matcher, matched, src);

        matched.forEach((index) => indexes.add(index));
        replacing ||= !!newURL;

        return newURL || undefined;
      },
    );

    if (replacing) {
      content[keyPath] = replaced;
    }
  }

  return { indexes, field };
};

/**
 * Walk the given entries once looking for all the given targets, calling back for each field
 * holding any of them. However many targets are given, each value is looked at once, so looking up
 * the assets of a whole folder costs about the same as looking up one.
 * @param {AssetReferenceTarget[]} targets Targets.
 * @param {object} options Options.
 * @param {Entry[]} options.entries Entries to be searched.
 * @param {boolean} [options.every] Whether to report every field holding a target. Otherwise the
 * search of an entry stops once every target has been found in it, unless the references are
 * being replaced.
 * @param {(reference: AssetReference) => void} [options.onMatch] Called for each field found.
 * @returns {Entry[][]} Entries holding each target, in the order of the targets, each list in the
 * order given.
 */
const findAssetReferences = (targets, { entries, every = false, onMatch }) => {
  const matcher = createMatcher(
    targets.map((target) =>
      target.url === undefined ? target : { ...target, url: getComparableAssetURL(target.url) },
    ),
  );

  const exhaustive = every || targets.some(({ newURL }) => !!newURL);
  /** @type {Entry[][]} */
  const results = targets.map(() => []);

  entries.forEach((entry) => {
    const { locales } = entry;
    /**
     * Collections associated with the entry, along with what each needs for matching a field.
     * @type {{
     * collection: InternalCollection,
     * isIndexFile: boolean,
     * files: (InternalCollectionFile | undefined)[],
     * }[] | undefined}
     */
    let collections;
    /** @type {Set<number>} */
    const found = new Set();
    /**
     * Check whether the rest of the entry can be skipped.
     * @returns {boolean} Result.
     */
    const isDone = () => !exhaustive && found.size === targets.length;

    for (const [locale, { content }] of Object.entries(locales)) {
      for (const [keyPath, value] of Object.entries(content)) {
        if (typeof value !== 'string' || !value) continue;
        // Pre-filter: skip values that can’t possibly refer to the targets, avoiding the expensive
        // getField() call for the vast majority of fields.
        if (!matcher.resolves && !mayReferToTargets(matcher, value)) continue;

        // Resolved only once a value passes the pre-filter, as most entries have none that does
        collections ??= getAssociatedCollections(entry).map((collection) => {
          const collectionFiles = getCollectionFilesByEntry(collection, entry);

          return {
            collection,
            isIndexFile: isCollectionIndexFile(collection, entry),
            files: collectionFiles.length ? collectionFiles : [undefined],
          };
        });

        for (const { collection, isIndexFile, files } of collections) {
          const matchArgs = {
            matcher,
            collectionName: collection.name,
            entry,
            content,
            keyPath,
            locale,
          };

          const matches = files.map((collectionFile) =>
            matchField({ ...matchArgs, value, isIndexFile, collectionFile }),
          );

          matches.forEach(({ indexes, field }, index) => {
            indexes.forEach((i) => found.add(i));

            if (indexes.size && onMatch) {
              onMatch({
                entry,
                collection,
                collectionFile: files[index],
                locale,
                keyPath,
                // The field is known to be configured, as nothing matches otherwise
                fieldConfig: /** @type {Field} */ (field),
              });
            }
          });

          if (isDone()) break;
        }

        if (isDone()) break;
      }

      if (isDone()) break;
    }

    found.forEach((index) => {
      results[index].push(entry);
    });
  });

  return results;
};

/**
 * Find entries by an asset URL, and replace the URL if needed.
 * @param {string} url Asset’s public or blob URL.
 * @param {object} [options] Options.
 * @param {Entry[]} [options.entries] Entries to be searched.
 * @param {string} [options.newURL] New URL to replace the found URL.
 * @returns {Promise<Entry[]>} Found (and replaced) entries.
 */
export const getEntriesByAssetURL = async (
  url,
  { entries = allEntries.current, newURL = '' } = {},
) => findAssetReferences([{ url, newURL }], { entries })[0];

/**
 * Find the entries holding each of the given targets, and replace the references to the targets
 * that have a new URL, in one pass over the entries.
 * @param {AssetReferenceTarget[]} targets Targets.
 * @param {object} [options] Options.
 * @param {Entry[]} [options.entries] Entries to be searched.
 * @returns {Promise<Entry[][]>} Found (and replaced) entries for each target, in the order of the
 * targets.
 */
export const getEntriesByAssets = async (targets, { entries = allEntries.current } = {}) =>
  findAssetReferences(targets, { entries });

/**
 * Find every field holding any of the given targets in the given entries, in one pass over them.
 * @param {AssetReferenceTarget[]} targets Targets.
 * @param {object} [options] Options.
 * @param {Entry[]} [options.entries] Entries to be searched.
 * @returns {Promise<AssetReference[]>} References, in the order found. An entry that belongs to
 * more than one collection is reported once per collection the field resolves in, and a field
 * holding several of the targets is reported once.
 */
export const getAssetReferences = async (targets, { entries = allEntries.current } = {}) => {
  /** @type {AssetReference[]} */
  const references = [];

  /**
   * Record a field found.
   * @param {AssetReference} reference Reference.
   */
  const onMatch = (reference) => {
    references.push(reference);
  };

  findAssetReferences(targets, { entries, every: true, onMatch });

  return references;
};
