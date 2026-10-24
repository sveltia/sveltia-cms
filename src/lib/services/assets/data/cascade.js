import { getAssetReferenceTarget } from '$lib/services/assets/reference-target';
import {
  createMediaSourceResolver,
  getAssetReferences,
  getComparableAssetURL,
} from '$lib/services/assets/references';
import { allAssets } from '$lib/services/assets/state';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import {
  compactList,
  dedupeBlockers,
  getFieldBlockers,
  ITEM_INDEX_SUFFIX_REGEX,
} from '$lib/services/contents/entry/cascade';
import { createSyntheticDraft } from '$lib/services/contents/entry/changes';
import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES } from '$lib/services/contents/fields';
import { getValueFormat } from '$lib/services/contents/fields/rich-text';
import {
  MARKDOWN_MEDIA_REGEX,
  rewriteMediaStartTag,
  updateMediaElementURLs,
} from '$lib/services/contents/fields/rich-text/previews/media-sources';
import { getMediaElements } from '$lib/services/contents/fields/rich-text/previews/media-urls';
import { parseHTMLFragment, serializeStartTag } from '$lib/services/utils/html';

/**
 * @import {
 * Asset,
 * AssetReference,
 * CascadeDeleteBlocker,
 * CascadeDeletePlan,
 * CascadeTarget,
 * Entry,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * MarkdownField,
 * RichTextField,
 * RichTextValueFormat,
 * } from '$lib/types/public';
 * @import { AssetReferenceTarget } from '$lib/services/assets/references';
 */

/**
 * Get what the references to the given assets are matched by, see {@link getAssetReferenceTarget},
 * with the URLs in the form they’re stored in a field value — without the site’s base URL.
 * @param {Asset[]} assets Assets.
 * @returns {AssetReferenceTarget[]} Targets, without duplicate URLs.
 */
export const getReferenceTargets = (assets) => {
  /** @type {AssetReferenceTarget[]} */
  const targets = [];
  /** @type {Set<string>} */
  const urls = new Set();

  assets.forEach((asset) => {
    const { url, asset: target } = getAssetReferenceTarget(asset);

    if (url === undefined) {
      targets.push({ asset: /** @type {Asset} */ (target) });

      return;
    }

    const comparableURL = getComparableAssetURL(url);

    if (!urls.has(comparableURL)) {
      urls.add(comparableURL);
      targets.push({ url: comparableURL });
    }
  });

  return targets;
};

/**
 * Cut a piece of markup out of a Markdown string. Markup on a line of its own — an image in a
 * paragraph of its own, typically — takes the line with it, along with one of the blank lines
 * around it, so no empty paragraph is left behind. Nothing else is touched: the rest of the text,
 * including any blank lines in a code block, is the author’s.
 * @param {string} text Markdown.
 * @param {number} index Position of the markup.
 * @param {number} length Length of the markup.
 * @returns {string} Markdown without the markup.
 */
const cutMarkup = (text, index, length) => {
  const end = index + length;
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;

  if (text.slice(lineStart, index).trim() || text.slice(end, lineEnd).trim()) {
    // The markup shares its line with something else
    return text.slice(0, index) + text.slice(end);
  }

  const before = text.slice(0, lineStart);
  // Everything from the line break ending the line, if any
  const after = text.slice(lineEnd);
  // A blank line on each side — or the start or end of the text — means one of the blank lines
  // would be in excess once the line is gone
  const blankBefore = !before || /\n[ \t]*\n$/.test(before);
  const blankAfter = !after || /^\n[ \t]*\n/.test(after);

  if (blankBefore && blankAfter) {
    return after
      ? // The line’s own break and the blank line after it
        before + after.replace(/^\n[ \t]*\n/, '')
      : // The blank line before the last line
        before.replace(/\n[ \t]*\n$/, '\n');
  }

  // The line’s own break goes, unless the line has none, in which case the preceding one does
  return after ? before + after.slice(1) : before.replace(/\n$/, '');
};

/**
 * Elements that are removed along with the media element they hold, once nothing else is left in
 * them, so no empty paragraph, figure or link is left behind.
 */
const MEDIA_WRAPPER_TAG_NAMES = ['a', 'div', 'figure', 'p', 'picture', 'span'];

/**
 * Check if a media element has nothing left to display once its URLs pointing at the deleted assets
 * have been removed: an image or a `<source>` without a `src` or `srcset`, or a video or audio
 * without a `src` or a `<source>`. A video keeps playing without its `poster`.
 * @param {Element} element Media element.
 * @returns {boolean} Result.
 */
const isMediaElementEmpty = (element) =>
  ['img', 'source'].includes(element.localName)
    ? !element.hasAttribute('src') && !element.hasAttribute('srcset')
    : !element.hasAttribute('src') && !element.querySelector(':scope > source');

/**
 * Remove a media element left with nothing to display from the parsed HTML, along with any wrapper
 * left empty. An image in a `<picture>` takes the picture with it, as its `<source>` elements
 * display nothing without one.
 * @param {Element} element Media element.
 */
const removeMediaElement = (element) => {
  /** @type {Element | null} */
  let target = element;

  if (element.localName === 'img' && element.parentElement?.localName === 'picture') {
    target = element.parentElement;
  }

  for (;;) {
    const parent = /** @type {Element | null} */ (target.parentElement);

    target.remove();

    if (
      !parent ||
      !MEDIA_WRAPPER_TAG_NAMES.includes(parent.localName) ||
      parent.childElementCount ||
      /** @type {string} */ (parent.textContent).trim()
    ) {
      break;
    }

    target = parent;
  }
};

/**
 * Remove the media pointing at the deleted assets from an HTML string. A URL pointing at a deleted
 * asset is removed from its element, e.g. a `srcset` candidate or a video `poster`, and an element
 * left with nothing to display goes, along with any wrapper left empty.
 * @param {string} value HTML.
 * @param {(src: string) => boolean} isStale Function checking whether a URL points at a deleted
 * asset.
 * @returns {string} HTML without the media, or the original one if nothing is removed.
 */
const removeHTMLMedia = (value, isStale) => {
  const template = parseHTMLFragment(value);
  const elements = getMediaElements(template);

  const affected = new Set(
    elements.filter((element) =>
      updateMediaElementURLs(element, (src) => (isStale(src) ? null : undefined)),
    ),
  );

  if (!affected.size) {
    return value;
  }

  // A `<source>` comes after its video or audio, so go backwards to have it removed first, then
  // see if the video or audio has anything left. An element that had nothing to display in the
  // first place is the author’s, and left as is
  elements.reverse().forEach((element) => {
    if (!affected.has(element) || !isMediaElementEmpty(element)) {
      return;
    }

    const { parentElement: parent } = element;

    if (element.localName === 'source' && parent && ['audio', 'video'].includes(parent.localName)) {
      affected.add(parent);
    }

    removeMediaElement(element);
  });

  return template.innerHTML;
};

/**
 * Remove the media pointing at the deleted assets from a Markdown string: a Markdown image is cut
 * out, and so is an image or a `<source>` written as raw HTML once it has nothing left to display.
 * The start tag of a video or audio written as raw HTML only loses its URLs pointing at the deleted
 * assets, as its content and end tag aren’t matched along with it.
 * @param {string} value Markdown.
 * @param {(src: string) => boolean} isStale Function checking whether a URL points at a deleted
 * asset.
 * @returns {string} Markdown without the media.
 */
const removeMarkdownMedia = (value, isStale) =>
  // Cut from the end, so the positions of the earlier matches stay valid
  [...value.matchAll(MARKDOWN_MEDIA_REGEX)].reduceRight((text, match) => {
    const { index, 0: markup, 1: src, 2: tag } = match;

    if (tag === undefined) {
      return isStale(src) ? cutMarkup(text, index, markup.length) : text;
    }

    const element = rewriteMediaStartTag({
      value,
      tag,
      index,
      /**
       * Remove a URL pointing at a deleted asset.
       * @param {string} url URL.
       * @returns {null | undefined} `null` to remove the URL, or `undefined` to leave it as is.
       */
      callback: (url) => (isStale(url) ? null : undefined),
    });

    if (!element) {
      return text;
    }

    if (['img', 'source'].includes(element.localName) && isMediaElementEmpty(element)) {
      return cutMarkup(text, index, markup.length);
    }

    return text.slice(0, index) + serializeStartTag(element) + text.slice(index + markup.length);
  }, value);

/**
 * Remove the media pointing at the deleted assets from a Markdown or RichText field value.
 * @param {object} args Arguments.
 * @param {string} args.value Field value.
 * @param {RichTextValueFormat} args.format Value format, as returned by `getValueFormat()`.
 * @param {Set<string>} args.urls URLs of the deleted assets.
 * @param {Set<string>} [args.paths] Paths of the deleted assets without a URL, as in an
 * entry-relative folder, which a media URL points at when it resolves to the asset.
 * @param {Entry} args.entry Entry holding the field.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name.
 * @param {InternalLocaleCode} [args.locale] Locale the field is in, which an entry-relative media
 * URL is relative to.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {FlattenedEntryContent} args.valueMap Content holding the field.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s special index file.
 * @param {MarkdownField | RichTextField} args.fieldConfig Field config, whose own `media_folder`
 * and those of its editor components a relative media URL may be resolved against.
 * @returns {string} Value without the media.
 */
export const removeEmbeddedMedia = ({
  value,
  format,
  urls,
  paths = new Set(),
  entry,
  collectionName,
  fileName,
  locale,
  keyPath,
  valueMap,
  isIndexFile,
  fieldConfig,
}) => {
  const resolve = createMediaSourceResolver({
    entry,
    collectionName,
    fileName,
    locale,
    keyPath,
    valueMap,
    isIndexFile,
    fieldConfig,
  });

  /**
   * Check whether a media URL points at a deleted asset.
   * @param {string} src URL.
   * @returns {boolean} Result.
   */
  const isStale = (src) => {
    if (urls.has(src)) {
      return true;
    }

    if (!paths.size) {
      return false;
    }

    // Resolve the path the way the editor does to display it, without loading the asset
    const path = resolve(src)?.asset?.path;

    return path !== undefined && paths.has(path);
  };

  return format === 'html' ? removeHTMLMedia(value, isStale) : removeMarkdownMedia(value, isStale);
};

/**
 * Remove the references to the deleted assets from a copy of the given content map: an Image or
 * File field is left empty, or loses the items in question and has its remaining items renumbered
 * if it holds several files, and a Markdown or rich text field loses the images and other media.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Flattened entry content. Not modified.
 * @param {AssetReference[]} args.references References to remove, all in this content.
 * @param {Set<string>} args.urls URLs of the deleted assets.
 * @param {Set<string>} [args.paths] Paths of the deleted assets without a URL.
 * @returns {{ content: FlattenedEntryContent, fields: Map<FieldKeyPath, Field> }}
 * Updated content and the fields that lost a reference, keyed by key path — the field itself
 * rather than an item within it, which is what the validator looks at.
 */
export const removeAssetReferences = ({ content, references, urls, paths = new Set() }) => {
  const updatedContent = { ...content };
  /** @type {Map<FieldKeyPath, Field>} */
  const fields = new Map();
  /** @type {Map<FieldKeyPath, Set<FieldKeyPath>>} */
  const staleListItems = new Map();

  references.forEach(({ entry, collection, collectionFile, locale, keyPath, fieldConfig }) => {
    const { widget: fieldType = 'string' } = fieldConfig;

    if (!MEDIA_FIELD_TYPES.includes(fieldType)) {
      // The reference is an image or other media embedded in a Markdown or rich text field
      const richTextField = /** @type {MarkdownField | RichTextField} */ (fieldConfig);

      updatedContent[keyPath] = removeEmbeddedMedia({
        value: content[keyPath],
        format: getValueFormat(richTextField),
        urls,
        paths,
        entry,
        collectionName: collection.name,
        fileName: collectionFile?.name,
        locale,
        keyPath,
        valueMap: content,
        isIndexFile: isCollectionIndexFile(collection, entry),
        fieldConfig: richTextField,
      });

      fields.set(keyPath, fieldConfig);

      return;
    }

    if (isFieldMultiple(fieldConfig)) {
      // The items are removed together once every reference is known, as the rest have to be
      // renumbered
      const listKeyPath = keyPath.replace(ITEM_INDEX_SUFFIX_REGEX, '');

      staleListItems.set(listKeyPath, (staleListItems.get(listKeyPath) ?? new Set()).add(keyPath));
      fields.set(listKeyPath, fieldConfig);

      return;
    }

    updatedContent[keyPath] = '';
    fields.set(keyPath, fieldConfig);
  });

  staleListItems.forEach((staleKeys, listKeyPath) => {
    /**
     * Check whether an item holds a reference to a deleted asset.
     * @param {FieldKeyPath} key Item key path.
     * @returns {boolean} Result.
     */
    const isStale = (key) => staleKeys.has(key);

    compactList({ content: updatedContent, listKeyPath, isStale });
  });

  return { content: updatedContent, fields };
};

/**
 * Work out what deleting the given assets means for the entries using them. The uncached
 * implementation of {@link planAssetDeletion}.
 * @param {Asset[]} assets Assets being deleted.
 * @returns {Promise<CascadeDeletePlan>} Plan.
 */
const createAssetDeletionPlan = async (assets) => {
  const referenceTargets = getReferenceTargets(assets);
  /** @type {Set<string>} */
  const urls = new Set();
  /** @type {Set<string>} */
  const paths = new Set();

  referenceTargets.forEach(({ url, asset }) => {
    if (asset) {
      paths.add(asset.path);
    } else {
      urls.add(/** @type {string} */ (url));
    }
  });

  // One pass over the entries finds the references to every asset, however many there are
  const references = await getAssetReferences(referenceTargets);
  const referencesByEntry = Map.groupBy(references, ({ entry }) => entry.id);

  const results = [...referencesByEntry.values()].map((entryReferences) => {
    // An entry belonging to several collections is written once, under the first collection its
    // fields resolve in, the way any save writes it under the collection it’s edited in
    const [{ entry, collection, collectionFile }] = entryReferences;

    const draft = createSyntheticDraft({
      collection,
      collectionFile,
      isIndexFile: isCollectionIndexFile(collection, entry),
    });

    const referencesByLocale = Map.groupBy(
      entryReferences.filter(
        (r) => r.collection === collection && r.collectionFile === collectionFile,
      ),
      ({ locale }) => locale,
    );

    /** @type {Entry['locales']} */
    const updatedLocales = {};
    /** @type {CascadeDeleteBlocker[]} */
    const blockers = [];

    referencesByLocale.forEach((localeReferences, locale) => {
      const localizedEntry = entry.locales[locale];

      const { content, fields } = removeAssetReferences({
        content: localizedEntry.content,
        references: localeReferences,
        urls,
        paths,
      });

      updatedLocales[locale] = { ...localizedEntry, content };
      blockers.push(
        ...getFieldBlockers({ draft, entry, collection, collectionFile, locale, content, fields }),
      );
    });

    /** @type {CascadeTarget} */
    const target = {
      entry: { ...entry, locales: { ...entry.locales, ...updatedLocales } },
      collection,
      collectionFile,
    };

    return { target, blockers };
  });

  return {
    targets: results.map(({ target }) => target),
    blockers: dedupeBlockers(results.flatMap(({ blockers }) => blockers)),
  };
};

/**
 * The last plan worked out, along with what it was worked out from.
 * @type {{
 * key: string,
 * entries: Entry[],
 * assets: Asset[],
 * config: object | undefined,
 * plan: Promise<CascadeDeletePlan>,
 * } | undefined}
 */
let lastPlan = undefined;

/* v8 ignore next */
/**
 * Reset {@link lastPlan} for tests.
 */
export const _resetAssetDeletionPlan = () => {
  lastPlan = undefined;
};

/**
 * Work out what deleting the given assets means for the entries using them: each reference is
 * removed, unless doing so would leave the field in breach of its own validation rules — a
 * `required` Image field with nothing left, a multi-file field with fewer than `min` files, a body
 * with nothing but the image — in which case the deletion is reported as blocked, so the entries
 * stay valid. See the counterpart for entries, `planCascadeDelete()`.
 *
 * The confirmation dialog works the plan out before the deletion does, so the last plan is kept and
 * handed out again for the same assets, as long as the entries, the assets and the configuration it
 * was worked out from haven’t been replaced since, which any change to them does.
 * @param {Asset[]} assets Assets being deleted.
 * @returns {Promise<CascadeDeletePlan>} Plan.
 */
export const planAssetDeletion = (assets) => {
  const key = assets.map(({ path }) => path).join('\n');
  const { current: entries } = allEntries;
  const { current: allAssetList } = allAssets;
  const { current: config } = cmsConfig;

  if (
    lastPlan?.key === key &&
    lastPlan.entries === entries &&
    lastPlan.assets === allAssetList &&
    lastPlan.config === config
  ) {
    return lastPlan.plan;
  }

  const plan = createAssetDeletionPlan(assets);

  lastPlan = { key, entries, assets: allAssetList, config, plan };

  // Don’t hand out a failed plan again; the next call tries anew
  plan.catch(() => {
    if (lastPlan?.plan === plan) {
      lastPlan = undefined;
    }
  });

  return plan;
};
