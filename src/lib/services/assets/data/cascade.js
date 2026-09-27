import { allAssets } from '$lib/services/assets';
import { getAssetPublicURL, getMediaFieldSource } from '$lib/services/assets/info';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import {
  getAssetReferences,
  getComparableAssetURL,
  MARKDOWN_IMAGE_REGEX,
} from '$lib/services/contents/collection/entries';
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
import { getOrCreate } from '$lib/services/utils/cache';

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
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 * @import { AssetReferenceTarget } from '$lib/services/contents/collection/entries';
 */

/**
 * Get what the references to the given assets are matched by: the public path of an asset that has
 * one, in the form it’s stored in a field value — without the site’s base URL — or else the asset
 * itself, as in an entry-relative folder, which a value refers to when it resolves to the asset.
 * The asset is matched without being loaded, unlike by its blob URL.
 * @param {Asset[]} assets Assets.
 * @returns {AssetReferenceTarget[]} Targets, without duplicate URLs.
 */
export const getReferenceTargets = (assets) => {
  /** @type {AssetReferenceTarget[]} */
  const targets = [];
  /** @type {Set<string>} */
  const urls = new Set();

  assets.forEach((asset) => {
    const url = getAssetPublicURL(asset, { allowSpecial: true, pathOnly: true });

    if (url === undefined) {
      targets.push({ asset });

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
 * Remove the images pointing at the deleted assets from a Markdown string.
 * @param {object} args Arguments.
 * @param {string} args.value Markdown.
 * @param {Set<string>} args.urls URLs of the deleted assets.
 * @param {Set<string>} [args.paths] Paths of the deleted assets without a URL, as in an
 * entry-relative folder, which an image points at when its source resolves to the asset.
 * @param {Entry} args.entry Entry holding the field.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name.
 * @returns {string} Markdown without the images.
 */
export const removeMarkdownImages = ({
  value,
  urls,
  paths = new Set(),
  entry,
  collectionName,
  fileName,
}) => {
  const matches = [...value.matchAll(MARKDOWN_IMAGE_REGEX)];

  const stale = matches.map(([, src]) => {
    if (urls.has(src)) {
      return true;
    }

    if (!paths.size) {
      return false;
    }

    // Resolve the image’s path the way the editor does to display it, without loading the asset
    const path = getMediaFieldSource({ entry, collectionName, fileName, value: src })?.asset?.path;

    return path !== undefined && paths.has(path);
  });

  // Cut from the end, so the positions of the earlier matches stay valid
  return matches.reduceRight(
    (text, { index, 0: markup }, i) => (stale[i] ? cutMarkup(text, index, markup.length) : text),
    value,
  );
};

/**
 * Remove the references to the deleted assets from a copy of the given content map: an Image or
 * File field is left empty, or loses the items in question and has its remaining items renumbered
 * if it holds several files, and a Markdown or rich text field loses the images.
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

  references.forEach(({ entry, collection, collectionFile, keyPath, fieldConfig }) => {
    const { widget: fieldType = 'string' } = fieldConfig;

    if (!MEDIA_FIELD_TYPES.includes(fieldType)) {
      // The reference is an image embedded in a Markdown or rich text field
      updatedContent[keyPath] = removeMarkdownImages({
        value: content[keyPath],
        urls,
        paths,
        entry,
        collectionName: collection.name,
        fileName: collectionFile?.name,
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
  /** @type {Map<string, AssetReference[]>} */
  const referencesByEntry = new Map();

  references.forEach((reference) => {
    const { id } = reference.entry;

    getOrCreate(referencesByEntry, id, () => []).push(reference);
  });

  const results = [...referencesByEntry.values()].map((entryReferences) => {
    // An entry belonging to several collections is written once, under the first collection its
    // fields resolve in, the way any save writes it under the collection it’s edited in
    const [{ entry, collection, collectionFile }] = entryReferences;

    const draft = createSyntheticDraft({
      collection,
      collectionFile,
      isIndexFile: isCollectionIndexFile(collection, entry),
    });

    /** @type {Map<InternalLocaleCode, AssetReference[]>} */
    const referencesByLocale = new Map();

    entryReferences
      .filter((r) => r.collection === collection && r.collectionFile === collectionFile)
      .forEach((reference) => {
        const { locale } = reference;

        getOrCreate(referencesByLocale, locale, () => []).push(reference);
      });

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
      blockers.push(...getFieldBlockers({ draft, entry, collection, locale, content, fields }));
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
