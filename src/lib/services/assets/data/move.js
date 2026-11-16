import { _ } from '@sveltia/i18n';
import { getPathInfo } from '@sveltia/utils/file';

import { assetUpdatesToast, refreshFocusedAssets } from '$lib/services/assets/data';
import { createAssetMoveChange } from '$lib/services/assets/data/move-change';
import { getAssetFoldersByPath, globalAssetFolder } from '$lib/services/assets/folders';
import { getAssetPublicURL } from '$lib/services/assets/info';
import { getAssetReferenceTarget } from '$lib/services/assets/reference-target';
import { getEntriesByAssets } from '$lib/services/assets/references';
import { assertOutsideCmsFolders } from '$lib/services/assets/reserved';
import { saveChanges } from '$lib/services/backends/save';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { getEntryCollectionContexts } from '$lib/services/contents/entry/contexts';
import { getReadonlyEntryLabel, isEntryReadonly } from '$lib/services/contents/entry/readonly';
import { getOrCreate } from '$lib/services/utils/cache';
import { encodeFilePath, getBaseName } from '$lib/services/utils/file';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * Entry,
 * EntryDraft,
 * FileChange,
 * InternalEntryCollection,
 * MovingAsset,
 * } from '$lib/types/private';
 * @import { CollectionIndexFile } from '$lib/types/public';
 * @import { AssetReferenceTarget } from '$lib/services/assets/references';
 */

/**
 * Get base properties for the entry draft.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to get base properties for.
 * @returns {Partial<EntryDraft>} Base properties for the entry draft.
 */
export const getDraftBaseProps = ({ entry }) => {
  const { locales } = entry;
  const localeEntries = Object.entries(locales);
  const originalLocales = Object.fromEntries(localeEntries.map(([locale]) => [locale, true]));

  const originalSlugs = Object.fromEntries(
    localeEntries.map(([locale, { slug }]) => [locale, slug]),
  );

  const originalValues = Object.fromEntries(
    localeEntries.map(([locale, { content }]) => [locale, content]),
  );

  return {
    createdAt: Date.now(),
    isNew: false,
    canPreview: true,
    originalEntry: entry,
    originalLocales,
    currentLocales: structuredClone(originalLocales),
    originalSlugs,
    currentSlugs: structuredClone(originalSlugs),
    originalValues,
    currentValues: structuredClone(originalValues),
    files: {},
    validities: {},
    validationMessages: {},
    expanderStates: {},
  };
};

/**
 * Add saving entry data to the stack.
 * @param {object} args Arguments.
 * @param {Partial<EntryDraft>} args.draftProps Entry draft properties.
 * @param {CollectionIndexFile} [args.indexFile] Index file of the collection.
 * @param {Entry[]} args.savingEntries Entries to be saved. This will be modified.
 * @param {FileChange[]} args.changes File changes to be saved. This will be modified.
 */
export const addSavingEntryData = async ({ draftProps, indexFile, savingEntries, changes }) => {
  const { collection, collectionFile } = draftProps;

  const { fields: regularFields = [] } =
    collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const draft = /** @type {EntryDraft} */ ({
    ...draftProps,
    fields: indexFile?.fields ?? regularFields,
  });

  const { savingEntry, changes: _changes } = await createSavingEntryData({
    draft,
    slugs: getSlugs({ draft }),
  });

  savingEntries.push(savingEntry);
  changes.push(..._changes);
};

/**
 * Collect changes for the given entry.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to collect changes for.
 * @param {Entry[]} args.savingEntries Entries to be saved. This will be modified.
 * @param {FileChange[]} args.changes File changes to be saved. This will be modified.
 */
export const collectEntryChanges = async ({ entry, savingEntries, changes }) => {
  const draftBaseProps = getDraftBaseProps({ entry });

  await Promise.all(
    getEntryCollectionContexts(entry).map(({ collection, collectionFile, isIndexFile }) => {
      /** @type {Partial<EntryDraft>} */
      const draftProps = {
        ...draftBaseProps,
        collection,
        collectionName: collection.name,
        isIndexFile,
        ...(collectionFile ? { collectionFile, fileName: collectionFile.name } : {}),
      };

      return addSavingEntryData({
        draftProps,
        indexFile: isIndexFile ? getIndexFile(collection) : undefined,
        savingEntries,
        changes,
      });
    }),
  );
};

/**
 * Get the new URL of a moved asset that has no public path, as in an entry-relative folder, by
 * swapping the folder’s internal path for its public path.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo | undefined} args._globalAssetFolder Global asset folder, if any.
 * @param {string} args.newPath New path for the asset.
 * @param {Asset} args.asset Asset being moved.
 * @returns {string} URL.
 */
const getFallbackURL = ({ _globalAssetFolder, newPath, asset }) => {
  const { publicPath } =
    getAssetFoldersByPath(asset.path).find(({ collectionName }) => collectionName !== undefined) ??
    _globalAssetFolder ??
    // There is no global folder without the global `media_folder` option
    asset.folder;

  return newPath.replace(asset.folder.internalPath ?? '', publicPath ?? '');
};

/**
 * Get a function that rewrites a reference to a renamed asset that has no public path, as in an
 * entry-relative folder. Such a reference is relative to the entry holding it, so only its file
 * name is swapped, leaving the rest — `./`, `../` or a subfolder — as the entry has it. A file name
 * encoded in the reference, as with the `encode_file_path` option, is replaced in the same form.
 * @param {string} oldName Current file name.
 * @param {string} newName New file name.
 * @returns {(src: string) => string | undefined} Function returning the new reference, or
 * `undefined` if the reference doesn’t end with the file name.
 */
const getRenamedReference = (oldName, newName) => (src) => {
  const [from, to] =
    [
      [oldName, newName],
      // The form the `encode_file_path` option saves a reference in
      [encodeFilePath(oldName), encodeFilePath(newName)],
      // A reference encoded by hand, which leaves characters like `(` and `)` as they are
      [encodeURI(oldName), encodeURI(newName)],
    ].find(([name]) => src === name || src.endsWith(`/${name}`)) ?? [];

  return from === undefined ? undefined : `${src.slice(0, -from.length)}${to}`;
};

/**
 * Get the message explaining why assets can’t be moved or renamed: some of the entries using them
 * are read-only, so the references in them can’t be updated, and leaving them pointing at a file
 * that’s no longer there would break them.
 * @param {Entry[]} entries Entries using the assets.
 * @returns {string | undefined} Message naming the read-only entries, or `undefined` if there is
 * none.
 */
export const getMoveBlockedMessage = (entries) => {
  const readonlyEntries = entries.filter((entry) => isEntryReadonly(entry));

  return readonlyEntries.length
    ? _('cannot_move_referenced_asset', {
        values: {
          entries: readonlyEntries.map((entry) => getReadonlyEntryLabel(entry)).join(', '),
        },
      })
    : undefined;
};

/**
 * Entries found to use some files, ahead of rewriting the references to the files once their new
 * locations are known.
 * @typedef {object} ReferenceRewritePlan
 * @property {AssetReferenceTarget[]} targets What the references to each file are matched by.
 * @property {Entry[][]} usedEntries Entries using each file, in the same order.
 */

/**
 * Find the entries using some files, before the files are moved, and refuse the move if any of
 * them is read-only: its references can’t be rewritten, and leaving it pointing at a file that’s no
 * longer there would break it. The entries are searched once for all the files, however many there
 * are. Nothing is replaced yet, so the originals are left alone until the change is saved.
 * @param {AssetReferenceTarget[]} targets What the references to each file are matched by.
 * @returns {Promise<ReferenceRewritePlan>} Plan to pass to {@link rewriteEntryReferences}.
 * @throws {Error} When an entry using the files is read-only, with a message naming the entries.
 */
export const planReferenceRewrite = async (targets) => {
  const usedEntries = targets.length ? await getEntriesByAssets(targets) : [];
  const blockedMessage = getMoveBlockedMessage([...new Set(usedEntries.flat())]);

  if (blockedMessage) {
    throw new Error(blockedMessage);
  }

  return { targets, usedEntries };
};

/**
 * Rewrite the references to some files in the entries found to use them, so these point at the
 * files’ new locations, which may be anywhere: another repository folder, or a cloud storage
 * service.
 * @param {object} args Arguments.
 * @param {ReferenceRewritePlan} args.plan Entries using the files, from
 * {@link planReferenceRewrite}.
 * @param {(index: number) => AssetReferenceTarget['newURL']} args.getNewURL Function returning the
 * new reference to the file at the given index, only called for a file some entry uses.
 * @param {Map<string, Entry>} args.updatingEntryMap Copies of the entries being rewritten, keyed by
 * entry ID. An entry using several of the files is copied once and has every reference replaced in
 * that copy, so it’s saved once with all of them; a copy per file would each hold a single
 * replacement and overwrite the others. The caller collects the changes from the copies.
 */
export const rewriteEntryReferences = async ({
  plan: { targets, usedEntries },
  getNewURL,
  updatingEntryMap,
}) => {
  /** @type {AssetReferenceTarget[]} */
  const replacingTargets = [];
  /** @type {Set<Entry>} */
  const updatingEntries = new Set();

  targets.forEach((target, index) => {
    if (usedEntries[index].length) {
      replacingTargets.push({ ...target, newURL: getNewURL(index) });
      usedEntries[index].forEach((entry) => updatingEntries.add(entry));
    }
  });

  if (!replacingTargets.length) {
    return;
  }

  const entries = [...updatingEntries].map((entry) =>
    getOrCreate(updatingEntryMap, entry.id, () => structuredClone(entry)),
  );

  // The references are replaced in place, in one pass over the copies
  await getEntriesByAssets(replacingTargets, { entries });
};

/**
 * Get the reference to an asset once it has been moved to another path in the repository. It’s
 * worked out the same way as the current one, so that the public folder, the `encode_file_path`
 * option and template tags are all dealt with alike. A move to another folder takes that folder’s
 * public path; otherwise the asset’s own folder still applies.
 * @param {MovingAsset & { _globalAssetFolder: AssetFolderInfo | undefined }} args Asset being
 * moved, its new path and folder, and the global asset folder, if any.
 * @returns {AssetReferenceTarget['newURL']} New reference, or a function rewriting a reference
 * relative to the entry holding it.
 */
const getNewAssetReference = ({
  _globalAssetFolder,
  asset,
  path: newPath,
  folder = asset.folder,
}) => {
  const newName = getBaseName(newPath);

  return (
    getAssetPublicURL(
      { ...asset, path: newPath, name: newName, folder },
      { pathOnly: true, allowSpecial: true },
    ) ??
    // A rename can be applied to a reference relative to the entry holding it
    (asset.folder.entryRelative &&
    newPath.slice(0, -newName.length) === asset.path.slice(0, -asset.name.length)
      ? getRenamedReference(asset.name, newName)
      : getFallbackURL({ _globalAssetFolder, newPath, asset }))
  );
};

/**
 * Rewrite the references to the given assets in the entries that use them, so these point at the
 * assets’ new paths in the repository.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo | undefined} args._globalAssetFolder Global asset folder, if any.
 * @param {MovingAsset[]} args.movingAssets Assets being moved, with their new paths.
 * @param {Map<string, Entry>} args.updatingEntryMap Copies of the entries being rewritten, see
 * {@link rewriteEntryReferences}.
 * @throws {Error} When an entry using the assets is read-only, with a message naming the entries.
 */
export const collectEntryChangesFromAssets = async ({
  _globalAssetFolder,
  movingAssets,
  updatingEntryMap,
}) => {
  await rewriteEntryReferences({
    // Matched the same way as everywhere else, e.g. the count of the entries using an asset: by its
    // public path, or else by the asset itself, as in an entry-relative folder, which works whether
    // or not the asset has been loaded
    plan: await planReferenceRewrite(
      movingAssets.map(({ asset }) => getAssetReferenceTarget(asset)),
    ),
    // eslint-disable-next-line jsdoc/require-jsdoc
    getNewURL: (index) => getNewAssetReference({ _globalAssetFolder, ...movingAssets[index] }),
    updatingEntryMap,
  });
};

/**
 * Rewrite the references to some files in the entries found to use them, as
 * {@link rewriteEntryReferences} does, and collect the changes to save the entries with.
 * @param {object} args Arguments.
 * @param {ReferenceRewritePlan} args.plan Entries using the files, from
 * {@link planReferenceRewrite}.
 * @param {(index: number) => AssetReferenceTarget['newURL']} args.getNewURL Function returning the
 * new reference to the file at the given index.
 * @returns {Promise<{ savingEntries: Entry[], changes: FileChange[] }>} Entries to be saved, and
 * the changes to their files. Both are empty when no entry uses the files.
 */
export const collectReferenceChanges = async ({ plan, getNewURL }) => {
  /** @type {Map<string, Entry>} */
  const updatingEntryMap = new Map();
  /** @type {Entry[]} */
  const savingEntries = [];
  /** @type {FileChange[]} */
  const changes = [];

  await rewriteEntryReferences({ plan, getNewURL, updatingEntryMap });
  await Promise.all(
    [...updatingEntryMap.values()].map((entry) =>
      collectEntryChanges({ entry, savingEntries, changes }),
    ),
  );

  return { savingEntries, changes };
};

/**
 * Save the changes to the entries using some moved files, if any, along with changes to other
 * files, e.g. the repository files being created or deleted, in one commit. Nothing is committed
 * when there’s nothing to change, as when a file on a cloud storage service that no entry uses is
 * moved.
 * @param {object} args Arguments.
 * @param {ReferenceRewritePlan} args.plan Entries using the files, from
 * {@link planReferenceRewrite}.
 * @param {string[]} args.newURLs New references to the files, in the same order.
 * @param {FileChange[]} [args.changes] Changes to other files.
 * @param {Asset[]} [args.savingAssets] Repository assets being saved.
 * @param {'uploadMedia' | 'deleteMedia'} args.commitType Commit type.
 */
export const saveReferenceChanges = async ({
  plan,
  newURLs,
  changes = [],
  savingAssets = [],
  commitType,
}) => {
  const { savingEntries, changes: entryChanges } = await collectReferenceChanges({
    plan,
    // eslint-disable-next-line jsdoc/require-jsdoc
    getNewURL: (index) => newURLs[index],
  });

  if (changes.length || entryChanges.length) {
    await saveChanges({
      changes: [...changes, ...entryChanges],
      savingEntries,
      savingAssets,
      options: { commitType },
    });
  }
};

/**
 * Update the asset and entry stores after moving or renaming assets.
 * @param {object} args Arguments.
 * @param {'move' | 'rename'} args.action The action performed, either 'move' or 'rename'.
 * @param {MovingAsset[]} args.movedAssets The assets that have been moved or renamed.
 * @param {boolean} [args.notify] Whether to show a toast reporting the move. Default: `true`.
 */
export const updateStores = ({ action, movedAssets, notify = true }) => {
  refreshFocusedAssets(({ path }) => movedAssets.find((a) => a.asset.path === path)?.path);

  if (notify) {
    assetUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      moved: action === 'move',
      renamed: action === 'rename',
      count: movedAssets.length,
    };
  }
};

/**
 * Move or rename assets while updating links in the entries.
 * @param {'move' | 'rename'} action Action type.
 * @param {MovingAsset[]} movingAssets Assets to be moved/renamed.
 * @param {object} [options] Options.
 * @param {FileChange[]} [options.extraChanges] Changes to files other than the assets, committed
 * along with the move, e.g. the `.gitkeep` of a folder being renamed.
 * @param {boolean} [options.notify] Whether to show a toast reporting the move. Default: `true`.
 * A caller that reports the result in its own words, like a folder rename, turns it off.
 */
export const moveAssets = async (
  action,
  movingAssets,
  { extraChanges = [], notify = true } = {},
) => {
  assertOutsideCmsFolders([
    ...movingAssets.flatMap(({ asset, path }) => [asset.path, path]),
    ...extraChanges.flatMap(({ path, previousPath }) => [
      path,
      ...(previousPath ? [previousPath] : []),
    ]),
  ]);

  const _globalAssetFolder = globalAssetFolder.current;
  /** @type {FileChange[]} */
  const changes = [];
  /** @type {Entry[]} */
  const savingEntries = [];
  /** @type {Asset[]} */
  const savingAssets = [];
  /** @type {Map<string, Entry>} */
  const updatingEntryMap = new Map();

  await Promise.all(
    movingAssets.map(async ({ asset, path, folder = asset.folder }) => {
      const name = getPathInfo(path).basename;

      savingAssets.push({ ...asset, path, name, folder });
      changes.push(await createAssetMoveChange(asset, path, name));
    }),
  );

  await collectEntryChangesFromAssets({ _globalAssetFolder, movingAssets, updatingEntryMap });

  await Promise.all(
    [...updatingEntryMap.values()].map((entry) =>
      collectEntryChanges({ entry, savingEntries, changes }),
    ),
  );

  await saveChanges({
    changes: [...changes, ...extraChanges],
    savingEntries,
    savingAssets,
    options: { commitType: 'uploadMedia' },
  });

  updateStores({ action, movedAssets: movingAssets, notify });
};
