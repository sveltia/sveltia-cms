/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { getMediaFieldSource, getRichTextMediaSource } from '$lib/services/assets/media-field';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry/collections';
import { getField, getTypedKeyPath } from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES, RICH_TEXT_FIELD_TYPES } from '$lib/services/contents/fields';
import { getValueFormat } from '$lib/services/contents/fields/rich-text';
import { getEditorComponentNames } from '$lib/services/contents/fields/rich-text/options';
import {
  getRichTextMediaSources,
  MARKDOWN_MEDIA_REGEX,
  parseMediaSource,
  updateRichTextMediaURLs,
} from '$lib/services/contents/fields/rich-text/previews/media-sources';
import {
  GLOBAL_MEDIA_TAG_REGEX,
  MEDIA_TAG_REGEX,
} from '$lib/services/contents/fields/rich-text/previews/media-urls';
import { decodeURIComponentSafely } from '$lib/services/utils/url';

/**
 * @import {
 * Asset,
 * AssetReference,
 * Entry,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * MediaFieldSource,
 * } from '$lib/types/private';
 * @import { MediaSource } from '$lib/services/contents/fields/rich-text/previews/media-sources';
 * @import {
 * Field,
 * FieldKeyPath,
 * MarkdownField,
 * MediaField,
 * RichTextField,
 * } from '$lib/types/public';
 */

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
 * Create a function resolving a media field value, or a media URL found in a Markdown or RichText
 * field value, to the file it points to, the way the editor does to display it, without loading
 * the file. A relative path is resolved against the field’s own `media_folder`, if any, and the
 * media URL in a body against those of the editor components the field can contain, too.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry holding the field.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name.
 * @param {InternalLocaleCode} [args.locale] Locale the value is found in, which an entry-relative
 * path is relative to.
 * @param {FieldKeyPath} args.keyPath Key path of the value.
 * @param {FlattenedEntryContent} args.valueMap Content holding the value, which tells the variable
 * types along the key path.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s special index file.
 * @param {Field} args.fieldConfig Field config.
 * @returns {(src: string) => MediaFieldSource | undefined} Function resolving a field value or a
 * media URL in it.
 */
export const createMediaSourceResolver = ({
  entry,
  collectionName,
  fileName,
  locale,
  keyPath,
  valueMap,
  isIndexFile,
  fieldConfig,
}) => {
  /** @type {string | undefined} */
  let typedKeyPath;

  return (src) => {
    // Worked out on the first lookup only, as most values don’t need resolving
    typedKeyPath ??= getTypedKeyPath({ collectionName, fileName, keyPath, valueMap, isIndexFile });

    const args = { entry, collectionName, fileName, typedKeyPath, locale, value: src };
    const { widget: fieldType = 'string' } = fieldConfig;

    if (MEDIA_FIELD_TYPES.includes(fieldType)) {
      return getMediaFieldSource({ ...args, fieldConfig: /** @type {MediaField} */ (fieldConfig) });
    }

    return getRichTextMediaSource({
      ...args,
      componentNames: getEditorComponentNames(
        /** @type {MarkdownField | RichTextField} */ (fieldConfig),
      ),
    });
  };
};

/**
 * @typedef {object} AssetURLMatch
 * @property {string} url Asset URL matched.
 * @property {string} fragment Fragment of the media URL left out of the match, or an empty string
 * if the whole URL matched.
 * @property {boolean} decoded Whether the media URL holds the asset URL percent-encoded.
 */

/**
 * Find the asset URL the given field value or media URL holds: the URL as is, then decoded, like
 * the `%20` an editor component writes for a space in a body, which is how the CMS itself stores a
 * URL there, and the preview decodes it to find the asset as well. A URL with a fragment, like
 * `/uploads/a.jpg#center`, is then looked up without it, the way the editor finds the asset to
 * display it, see `getAssetByPath()`; the whole URL comes first, as an unencoded file name can
 * contain `#`, like `photo #1.jpg`.
 * @param {string | MediaSource} src Field value, or media URL found in it, as parsed by
 * `parseMediaSource()`.
 * @param {(url: string) => boolean} isAssetURL Function checking whether a URL is one of the asset
 * URLs being looked for.
 * @returns {AssetURLMatch | undefined} Match, if any.
 */
export const matchAssetURL = (src, isAssetURL) => {
  const { url, path, fragment } = typeof src === 'string' ? parseMediaSource(src) : src;

  // The whole URL, then the path without the fragment, if any
  /** @type {[string, string][]} */
  const forms = fragment
    ? [
        [url, ''],
        [path, fragment],
      ]
    : [[url, '']];

  for (const [value, rest] of forms) {
    if (isAssetURL(value)) {
      return { url: value, fragment: rest, decoded: false };
    }

    // Every string value goes through the pre-filter, and only one with a `%` can be decoded
    const decoded = value.includes('%') ? decodeURIComponentSafely(value) : value;

    if (decoded !== value && isAssetURL(decoded)) {
      return { url: decoded, fragment: rest, decoded: true };
    }
  }

  return undefined;
};

/**
 * Get the targets whose URL the given field value or media URL holds, in any of the forms
 * {@link matchAssetURL} accepts.
 * @param {AssetReferenceMatcher} matcher Matcher.
 * @param {string | MediaSource} src Field value, or media URL found in it.
 * @returns {number[] | undefined} Indexes of the targets, if any.
 */
const getURLTargets = (matcher, src) => {
  const { byURL } = matcher;
  const match = matchAssetURL(src, (key) => byURL.has(key));

  return match && byURL.get(match.url);
};

/**
 * Get the targets the given field value or media URL refers to.
 * @param {AssetReferenceMatcher} matcher Matcher.
 * @param {MediaSource} source Field value, or media URL found in it, as parsed by
 * `parseMediaSource()`.
 * @param {(src: string) => MediaFieldSource | undefined} resolve Function resolving the value to
 * an asset, as returned by {@link createMediaSourceResolver}.
 * @returns {number[]} Indexes of the targets.
 */
const getMatchingTargets = (matcher, source, resolve) => {
  const indexes = getURLTargets(matcher, source) ?? [];

  if (!matcher.resolves) {
    return indexes;
  }

  // Resolve the value to its asset without loading it. The asset’s blob URL is created once and
  // kept on the asset object, so only the asset being looked up can hold the given one — and
  // there’s no need to download every other asset the entries reference just to compare URLs
  const { url, asset } = resolve(source.url) ?? {};
  const blobURL = url ?? asset?.blobURL;

  return [
    ...indexes,
    ...((blobURL !== undefined && matcher.byBlobURL.get(blobURL)) || []),
    ...((asset && matcher.byPath.get(asset.path)) || []),
  ];
};

/**
 * Get the new URL to replace a reference to the given targets with, in the form of the reference.
 * A fragment the reference was matched without, like `#center`, is kept. A space in the new URL is
 * encoded as `%20` in a Markdown image source, as the CMS writes it when inserting a file there,
 * see `toFieldValue()`, because the source can’t hold a space unless wrapped in angle brackets —
 * so not in a source wrapped as such. In an HTML attribute, it’s encoded unless the URL replaced
 * already holds a space. In a media field, it’s encoded if the reference holds the URL encoded.
 * @param {AssetReferenceMatcher} matcher Matcher.
 * @param {number[]} indexes Indexes of the targets referred to.
 * @param {MediaSource} source Reference being replaced, as parsed by `parseMediaSource()`.
 * @returns {string | undefined} New URL, if any.
 */
const getNewURL = (matcher, indexes, source) => {
  const { url: src, path, fragment, syntax, bracketed } = source;

  /**
   * Put the new URL in the form of the reference.
   * @param {string} newURL New URL.
   * @param {string} rest Fragment of the reference the new URL doesn’t replace, if any.
   * @param {boolean} [decoded] Whether the reference holds the URL percent-encoded.
   * @returns {string} New reference.
   */
  const format = (newURL, rest, decoded = false) => {
    const encode =
      syntax === 'markdown'
        ? !bracketed
        : syntax === 'html'
          ? !(rest ? path : src).includes(' ')
          : decoded;

    return `${encode ? newURL.replaceAll(' ', '%20') : newURL}${rest}`;
  };

  return indexes
    .map((index) => {
      const { url, newURL } = matcher.targets[index];

      if (typeof newURL === 'function') {
        // The whole reference first, as an unencoded file name can contain `#`
        const whole = newURL(src);

        if (whole) {
          return format(whole, '');
        }

        const partial = fragment ? newURL(path) : undefined;

        return partial ? format(partial, fragment) : undefined;
      }

      if (!newURL) {
        return undefined;
      }

      // A target matched by URL may have been matched without the reference’s fragment, while one
      // matched by resolution replaces the whole reference
      const match = url === undefined ? undefined : matchAssetURL(source, (key) => key === url);

      return format(newURL, match?.fragment ?? '', match?.decoded);
    })
    .find(Boolean);
};

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
  if (getURLTargets(matcher, value)) {
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
  const hasTarget = (sources) => sources.some((src) => !!getURLTargets(matcher, src));

  if (hasTarget(getRichTextMediaSources(value, 'markdown'))) {
    return true;
  }

  const tagCount = [...value.matchAll(MARKDOWN_MEDIA_REGEX)].filter(
    ({ groups }) => groups?.tag,
  ).length;

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

  const resolve = createMediaSourceResolver({
    entry,
    collectionName,
    fileName,
    locale,
    keyPath,
    valueMap: content,
    isIndexFile,
    fieldConfig: field,
  });

  if (MEDIA_FIELD_TYPES.includes(fieldType)) {
    const source = parseMediaSource(value);
    const matched = getMatchingTargets(matcher, source, resolve);
    const newURL = getNewURL(matcher, matched, source);

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
      (_url, source) => {
        const matched = getMatchingTargets(matcher, source, resolve);

        if (!matched.length) {
          return undefined;
        }

        const newURL = getNewURL(matcher, matched, source);

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
 * that have a new URL, in one pass over the entries. Synchronous, for a caller that can’t wait,
 * like a derived state; see {@link getEntriesByAssets} otherwise.
 * @param {AssetReferenceTarget[]} targets Targets.
 * @param {object} [options] Options.
 * @param {Entry[]} [options.entries] Entries to be searched.
 * @returns {Entry[][]} Found (and replaced) entries for each target, in the order of the targets.
 */
export const findEntriesByAssets = (targets, { entries = allEntries.current } = {}) =>
  findAssetReferences(targets, { entries });

/**
 * Find the entries holding each of the given targets, and replace the references to the targets
 * that have a new URL, in one pass over the entries.
 * @param {AssetReferenceTarget[]} targets Targets.
 * @param {object} [options] Options.
 * @param {Entry[]} [options.entries] Entries to be searched.
 * @returns {Promise<Entry[][]>} Found (and replaced) entries for each target, in the order of the
 * targets.
 */
export const getEntriesByAssets = async (targets, options) => findEntriesByAssets(targets, options);

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
