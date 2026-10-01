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

/**
 * @import {
 * Asset,
 * AssetReference,
 * Entry,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
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
 * @returns {number[]} Indexes of the targets.
 */
const getMatchingTargets = (matcher, src, { entry, collectionName, fileName }) => {
  const indexes = matcher.byURL.get(src) ?? [];

  if (!matcher.resolves) {
    return indexes;
  }

  // Resolve the value to its asset without loading it. The asset’s blob URL is created once and
  // kept on the asset object, so only the asset being looked up can hold the given one — and
  // there’s no need to download every other asset the entries reference just to compare URLs
  const { url, asset } = getMediaFieldSource({ entry, collectionName, fileName, value: src }) ?? {};
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
 * a target either as a whole, in a media field, or as the source of an image in Markdown, so a
 * value that’s neither can be skipped before the costly field lookup.
 * @param {AssetReferenceMatcher} matcher Matcher, which must not need to resolve values.
 * @param {string} value Field value.
 * @returns {boolean} Result.
 */
const mayReferToTargets = (matcher, value) =>
  matcher.byURL.has(value) ||
  (value.includes('![') &&
    [...value.matchAll(MARKDOWN_IMAGE_REGEX)].some(([, src]) => matcher.byURL.has(src)));

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
}) => {
  /** @type {Set<number>} */
  const indexes = new Set();
  const fileName = collectionFile?.name;
  const field = getField({ collectionName, fileName, valueMap: content, keyPath, isIndexFile });

  if (!field) {
    return { indexes };
  }

  const { widget: fieldType = 'string' } = field;
  const context = { entry, collectionName, fileName };

  if (MEDIA_FIELD_TYPES.includes(fieldType)) {
    const matched = getMatchingTargets(matcher, value, context);
    const newURL = getNewURL(matcher, matched, value);

    matched.forEach((index) => indexes.add(index));

    if (newURL) {
      content[keyPath] = newURL;
    }

    return { indexes, field };
  }

  // Search images in markdown body
  if (RICH_TEXT_FIELD_TYPES.includes(fieldType)) {
    let replacing = false;

    // Swap the URL within each matched image only, rather than its first occurrence in the text,
    // which can be a link to the same file, the alt text, or the new URL written by a previous
    // replacement. The new value is built from the original one, so doing this again, once for
    // each collection the entry belongs to, gives the same result
    const replaced = value.replace(MARKDOWN_IMAGE_REGEX, (image, /** @type {string} */ src) => {
      const matched = getMatchingTargets(matcher, src, context);

      if (!matched.length) {
        return image;
      }

      const newURL = getNewURL(matcher, matched, src);

      matched.forEach((index) => indexes.add(index));
      replacing ||= !!newURL;

      // The source follows the first `](`, as the alt text is matched lazily
      const index = image.indexOf('](') + 2;

      return `${image.slice(0, index)}${newURL || src}${image.slice(index + src.length)}`;
    });

    if (replacing) {
      content[keyPath] = replaced;
    }
  }

  return { indexes, field };
};

/**
 * Check if the field contains the asset.
 * @param {object} args Arguments.
 * @param {string} args.assetURL Asset’s public or blob URL.
 * @param {string} [args.newURL] New URL to replace the found URL.
 * @param {string} args.collectionName Collection name.
 * @param {Entry} args.entry Entry.
 * @param {FlattenedEntryContent} args.content Value map for the collection. This will be modified
 * if the URL is replaced.
 * @param {FieldKeyPath} args.keyPath Key path of the value in the collection.
 * @param {string} args.value Value of the field.
 * @param {boolean} args.isIndexFile Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File collection only.
 * @returns {boolean} Result.
 */
export const hasAsset = ({ assetURL, newURL, ...args }) =>
  matchField({ matcher: createMatcher([{ url: assetURL, newURL }]), ...args }).indexes.size > 0;

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
    /** @type {InternalCollection[] | undefined} */
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
        collections ??= getAssociatedCollections(entry);

        for (const collection of collections) {
          const isIndexFile = isCollectionIndexFile(collection, entry);
          const matchArgs = { matcher, collectionName: collection.name, entry, content, keyPath };
          const collectionFiles = getCollectionFilesByEntry(collection, entry);
          /** @type {(InternalCollectionFile | undefined)[]} */
          const files = collectionFiles.length ? collectionFiles : [undefined];

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
