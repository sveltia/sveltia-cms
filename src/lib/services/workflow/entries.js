import { parseAssetFileInfo } from '$lib/services/backends/git/shared/parse-files';
import { toFileListItem } from '$lib/services/backends/git/shared/tree';
import { createFileList } from '$lib/services/backends/process';
import { isInRootDir } from '$lib/services/backends/root-dir';
import { isReadonly } from '$lib/services/config/readonly';
import { allEntries, findEntryByPaths } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import {
  getEntriesByCollection,
  matchesCollectionFilter,
} from '$lib/services/contents/collection/entries';
import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
import { isEntryEditableAlong } from '$lib/services/contents/entry/editable';
import { getEntryPaths } from '$lib/services/contents/entry/paths';
import { prepareEntries } from '$lib/services/contents/file/process';
import { getEntryFoldersByPath } from '$lib/services/contents/folders';
import { usesMultiFileStructure } from '$lib/services/contents/i18n/config';
import { parseBranchName } from '$lib/services/workflow/branch';

/**
 * @import {
 * Asset,
 * BaseEntryListItem,
 * BaseFileListItemProps,
 * CompanionEntry,
 * Entry,
 * InternalEntryCollection,
 * EntryFolderInfo,
 * WorkflowStatus,
 * UnpublishedEntry,
 * UnpublishedEntryProps,
 * WorkflowPullRequest,
 * } from '$lib/types/private';
 */

/**
 * Get the given entry collection, which is known to exist.
 * @param {string} name Collection name.
 * @returns {InternalEntryCollection} Collection.
 */
const getEntryCollection = (name) => /** @type {InternalEntryCollection} */ (getCollection(name));

/**
 * Assign the given entry file to the given collection if its path is in one of the collection’s
 * folders. Collections can share a folder and tell their entries apart with the `filter` option,
 * but the file list assigns a file to the first of them only, so a file of the collection a pull
 * request was opened for may come with the folder of another one.
 * @param {BaseEntryListItem} file Entry file.
 * @param {string} collectionName Collection name.
 * @returns {BaseEntryListItem} Entry file, with the collection’s folder if the path is in it.
 * @see https://github.com/sveltia/sveltia-cms/issues/1149
 */
const assignToCollection = (file, collectionName) => {
  if (file.folder.collectionName === collectionName) {
    return file;
  }

  const folder = getEntryFoldersByPath(file.path).find(
    (candidate) => candidate.collectionName === collectionName,
  );

  return folder ? { ...file, folder } : file;
};

/**
 * Find the folder of another collection an entry parsed for the given collection belongs to: an
 * entry the collection’s `filter` option excludes, in a folder it shares with a collection whose
 * filter the entry passes. That’s an entry of the other collection committed along with the entry
 * the pull request was opened for, such as one created from a Relation field.
 * @param {Entry} entry Entry.
 * @param {string} collectionName Name of the collection the entry was parsed for.
 * @returns {EntryFolderInfo | undefined} Folder of the other collection, if any.
 */
const findOtherCollectionFolder = (entry, collectionName) => {
  const otherFolders = getEntryFoldersByPath(getEntryPaths(entry)[0]).filter(
    (folder) => folder.collectionName !== collectionName,
  );

  if (!otherFolders.length) {
    return undefined;
  }

  // Both collections exist, as the entry was parsed from a file in their folders
  if (matchesCollectionFilter(getEntryCollection(collectionName), entry)) {
    return undefined;
  }

  return otherFolders.find((folder) =>
    matchesCollectionFilter(getEntryCollection(folder.collectionName), entry),
  );
};

/**
 * Get the key that links the localized files of an entry with the multi-file i18n structure, as
 * {@link prepareEntries} does: the canonical slug if one of the files has it, or the sub path.
 * @param {Entry} entry Entry.
 * @param {string} canonicalSlugKey Property name of the canonical slug.
 * @returns {string} Key.
 */
const getLinkingKey = (entry, canonicalSlugKey) =>
  Object.values(entry.locales)
    .map(({ content }) => content[canonicalSlugKey])
    .find((value) => typeof value === 'string') ?? entry.subPath;

/**
 * Find the published version of an entry parsed from a pull request.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry parsed from the pull request.
 * @param {string[]} args.previousPaths File paths the pull request renamed the entry from.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name.
 * @returns {Entry | undefined} Published entry.
 */
const findPublishedEntry = ({ entry, previousPaths, collectionName, fileName }) => {
  // `allEntries` holds the version currently on the configured branch
  const publishedEntry = findEntryByPaths(new Set([...getEntryPaths(entry), ...previousPaths]));

  if (publishedEntry) {
    return publishedEntry;
  }

  // A locale turned on for the entry adds a file the published version doesn’t have, so a pull
  // request carrying only that file shares no path with it. Link the files the way the entry list
  // does instead: a collection file by its name, and an entry by its canonical slug or sub path
  if (fileName) {
    return getCollectionFileEntry(collectionName, fileName);
  }

  const collection = getCollection(collectionName);

  // Other structures keep every locale in the same file, which a path always finds
  if (!collection || !usesMultiFileStructure(collection._i18n.structureMap)) {
    return undefined;
  }

  const canonicalSlugKey = collection._i18n.canonicalSlug.key;
  const linkingKey = getLinkingKey(entry, canonicalSlugKey);

  return getEntriesByCollection(collectionName).find(
    (published) => getLinkingKey(published, canonicalSlugKey) === linkingKey,
  );
};

/**
 * Fill in the parts of an unpublished entry that the pull request doesn’t carry. With the
 * multi-file i18n structure, an entry is spread over one file per locale and only the changed ones
 * are committed, so the rest have to come from the published version. Without them the editor shows
 * the untouched locales as disabled, and an entry whose default locale file isn’t in the pull
 * request has no slug at all, because the slug is read from that file alone.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry parsed from the pull request.
 * @param {string[]} args.previousPaths File paths the pull request renamed the entry from.
 * @param {Set<string>} args.deletedPaths File paths the pull request deletes. A locale turned off
 * for the entry has its file deleted, so it’s left out rather than brought back from the published
 * version.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name.
 * @param {Entry} [args.publishedEntry] Published version of the entry, if already known. Looked up
 * otherwise.
 * @returns {Entry} Entry with the unchanged locales merged in.
 */
const completeEntry = ({
  entry,
  previousPaths,
  deletedPaths,
  collectionName,
  fileName,
  publishedEntry = findPublishedEntry({ entry, previousPaths, collectionName, fileName }),
}) => {
  if (!publishedEntry) {
    return entry;
  }

  // A rename commits every locale file, so the pull request’s own slug is authoritative. Otherwise
  // the published entry is: the slug may have come from a non-default locale file, which differs
  // from the entry’s own slug when localized slugs are in use
  const renamed = !!previousPaths.length && !!entry.slug;

  return {
    ...publishedEntry,
    ...entry,
    // The pull request wins for the locales it carries; the others stay as published, unless it
    // deletes their files
    locales: {
      ...Object.fromEntries(
        Object.entries(publishedEntry.locales).filter(([, { path }]) => !deletedPaths.has(path)),
      ),
      ...entry.locales,
    },
    slug: renamed ? entry.slug : publishedEntry.slug,
    subPath: renamed ? entry.subPath : publishedEntry.subPath,
  };
};

/**
 * Parse the entries of other collections that ride along in a pull request: those created or
 * edited from a Relation field of the entry the pull request was opened for, and committed with it.
 * A new entry is one the configured branch doesn’t have yet, in a collection the CMS can create
 * entries in. An existing one is changed in the pull request; its unchanged locales come from the
 * published version, whose ID it keeps. That’s also how the CMS rewrites another entry along with
 * the entry, e.g. to update a reference to it on a rename, so such an entry is listed as edited
 * too.
 * A file of a file collection, which a Relation field can’t add to or edit, or of a collection the
 * CMS can’t write to that way, isn’t one of them: such a file is left for the publish check to
 * refuse.
 * @param {BaseEntryListItem[]} entryFiles Entry files in the pull request, with their text.
 * @param {string} collectionName Name of the collection the pull request was opened for.
 * @param {Set<string>} deletedPaths File paths the pull request deletes, such as the file of a
 * locale turned off for an edited entry.
 * @returns {Promise<CompanionEntry[]>} Entries.
 */
const parseCompanions = async (entryFiles, collectionName, deletedPaths) => {
  /**
   * Check whether the CMS can create an entry in the given collection.
   * @param {string} name Collection name.
   * @returns {boolean} Result.
   */
  const isCreatable = (name) => getEntryCollection(name).create !== false;

  // Neither kind can be in a collection the CMS can’t write to, so its files aren’t parsed at all
  const files = entryFiles.filter(({ folder, text }) => {
    const collection = getCollection(folder.collectionName);

    return (
      folder.collectionName !== collectionName &&
      folder.fileName === undefined &&
      text !== undefined &&
      collection?._type === 'entry' &&
      !isReadonly({ collection })
    );
  });

  const results = await Promise.all(
    [...Map.groupBy(files, ({ folder }) => folder.collectionName)].map(
      async ([companionCollectionName, companionFiles]) =>
        (await prepareEntries(companionFiles)).entries.flatMap((entry) => {
          const publishedEntry = findPublishedEntry({
            entry,
            previousPaths: [],
            collectionName: companionCollectionName,
          });

          if (!publishedEntry) {
            return isCreatable(companionCollectionName)
              ? [{ collectionName: companionCollectionName, entry }]
              : [];
          }

          if (!isEntryEditableAlong(getEntryCollection(companionCollectionName), publishedEntry)) {
            return [];
          }

          return [
            {
              collectionName: companionCollectionName,
              entry: {
                ...completeEntry({
                  entry,
                  previousPaths: [],
                  deletedPaths,
                  collectionName: companionCollectionName,
                  publishedEntry,
                }),
                id: publishedEntry.id,
              },
              edited: true,
            },
          ];
        }),
    ),
  );

  return results.flat();
};

/**
 * Pick the entries a pull request was opened for out of those parsed from the files of its
 * collection. Renaming or deleting an entry rewrites the other entries of the collection that
 * reference it, in a collection with a Relation field pointing at itself, and moving an entry of a
 * nested collection moves the entries below it along. Those files are committed to the same branch,
 * but they belong to the entries the CMS rewrote, which are published as they were written and
 * aren’t listed: the publish check accounts for them. The branch name tells the entry apart, as it
 * carries the slug the entry had when the pull request was opened, either its published one or the
 * one it’s saved with; a new entry, which no other entry can reference yet, is the branch’s as
 * well. An entry renamed again after the pull request was opened matches neither, so if nothing
 * else does, the entry the pull request renamed is taken, the one highest up the tree if the
 * entries below it moved along. Otherwise a pull request that vacates a path of the collection
 * deletes the entry, which has no file left to parse, while one that doesn’t keeps every entry, so
 * it doesn’t vanish from the board.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries Entries parsed from the pull request.
 * @param {string} args.slug Entry slug, or collection file name, the branch name carries.
 * @param {WorkflowPullRequest} args.pullRequest Pull request.
 * @param {string[]} args.previousPaths Paths of the collection’s entry files the pull request
 * renames or deletes.
 * @returns {Entry[]} Entries of the pull request.
 */
const findOwnEntries = ({ entries, slug, pullRequest, previousPaths: vacatedPaths }) => {
  const renames = new Map(
    pullRequest.files.flatMap(({ path, previousPath }) =>
      previousPath ? [[path, previousPath]] : [],
    ),
  );

  const candidates = entries.map((entry) => {
    const paths = getEntryPaths(entry);
    const previousPaths = paths.flatMap((path) => renames.get(path) ?? []);

    const publishedEntry =
      findEntryByPaths(paths) ??
      (previousPaths.length ? findEntryByPaths(previousPaths) : undefined);

    return { entry, publishedEntry, renamed: !!previousPaths.length };
  });

  const ownEntries = candidates
    .filter(
      ({ entry, publishedEntry }) =>
        !publishedEntry || entry.slug === slug || publishedEntry.slug === slug,
    )
    .map(({ entry }) => entry);

  if (ownEntries.length) {
    return ownEntries;
  }

  if (!vacatedPaths.length) {
    return entries;
  }

  /**
   * Get the depth of the given entry in its collection.
   * @param {Entry} entry Entry.
   * @returns {number} Number of path segments in its sub path.
   */
  const getDepth = (entry) => entry.subPath.split('/').length;

  const [movedEntry] = candidates
    .filter(({ renamed }) => renamed)
    .map(({ entry }) => entry)
    .sort((a, b) => getDepth(a) - getDepth(b));

  return movedEntry ? [movedEntry] : [];
};

/**
 * Contents of one or more pull requests.
 * @typedef {object} PullRequestContents
 * @property {UnpublishedEntry[]} entries Unpublished entries.
 * @property {Asset[]} assets Assets committed along with the entries. These only exist on the
 * workflow branch until the entries are published.
 */

/**
 * Create the workflow properties of an unpublished entry, which tie it to its pull request.
 * @param {object} args Arguments.
 * @param {WorkflowPullRequest} args.pullRequest Pull request holding the entry.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string[]} [args.previousPaths] Paths the entry occupied before the pull request.
 * @param {CompanionEntry[]} [args.companions] New entries of other collections in the pull request.
 * @returns {UnpublishedEntryProps} Properties.
 */
export const createUnpublishedEntryProps = ({
  pullRequest,
  collectionName,
  fileName,
  previousPaths,
  companions = [],
}) => ({
  pullRequest,
  status: pullRequest.status,
  collectionName,
  fileName,
  previousPaths,
  ...(companions.length ? { companions } : {}),
});

/**
 * Convert the files in the given pull request to entries and assets in the canonical format, so
 * they can be displayed and edited with the regular entry list and editor components.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @returns {Promise<PullRequestContents>} Entries and assets. There’s usually a single entry, but a
 * pull request can technically contain multiple entries.
 */
export const convertPullRequest = async (pullRequest) => {
  const parsed = parseBranchName(pullRequest.branch);

  // A branch named without the root directory belongs to the site only if all its files are in the
  // directory; otherwise it’s another site’s in the monorepo, or a change the CMS can’t show
  if (
    !parsed ||
    (parsed.legacy &&
      pullRequest.files.some(
        ({ path, previousPath }) =>
          !isInRootDir(path) || (previousPath !== undefined && !isInRootDir(previousPath)),
      ))
  ) {
    return { entries: [], assets: [] };
  }

  const { collectionName } = parsed;

  const files = /** @type {BaseFileListItemProps[]} */ (
    pullRequest.files
      .filter(({ deleted }) => !deleted)
      .map(({ path, sha, size, text }) => toFileListItem(path, { sha, size, text }))
  );

  const { entryFiles: listedEntryFiles, assetFiles } = createFileList(files);
  let entryFiles = listedEntryFiles.map((file) => assignToCollection(file, collectionName));

  // Editing the slug renames the entry file. Keep the path it came from, so the entry list can
  // still match the draft with its published counterpart. Both backends report a rename with the
  // old path, and a file the pull request simply deleted counts too.
  const vacatedPaths = pullRequest.files.flatMap(({ path, deleted, previousPath }) => {
    if (previousPath) {
      return [previousPath];
    }

    return deleted ? [path] : [];
  });

  const vacatedEntryFiles = vacatedPaths.length
    ? createFileList(vacatedPaths.map((path) => toFileListItem(path)))
        .entryFiles.map((file) => assignToCollection(file, collectionName))
        .filter(({ folder }) => folder.collectionName === collectionName)
    : [];

  const previousPaths = vacatedEntryFiles.map(({ path }) => path);

  // Files deleted outright, as opposed to renamed. With the multi-file i18n structure, turning off
  // a locale deletes that locale’s file only.
  const deletedPaths = new Set(
    pullRequest.files.filter(({ deleted }) => deleted).map(({ path }) => path),
  );

  // An image attached to an unpublished entry is committed to the workflow branch only, so it’s
  // missing from the asset list built from the configured branch. Parse it here so the entry
  // editor and the entry list can show it. The blob itself is fetched by its SHA, which works
  // regardless of the branch it lives on.
  const assets = assetFiles.map((file) => ({
    ...parseAssetFileInfo(file),
    workflow: { branch: pullRequest.branch },
  }));

  // Only keep the files that belong to the collection indicated by the branch name, so that a file
  // committed along with the entry doesn’t create a bogus entry. A binary file has no text, so it
  // can’t be parsed as an entry either.
  let targetFiles = entryFiles.filter(
    ({ folder, text }) => folder.collectionName === collectionName && text !== undefined,
  );

  const parsedEntries = targetFiles.length ? (await prepareEntries(targetFiles)).entries : [];

  // An entry of another collection sharing the folder, which the collection’s filter excludes, is
  // handed over to that collection, so it’s parsed as an entry committed along with the entry. The
  // entry the branch is named after stays, even if an edit took it out of the filter, and so do the
  // entries if none would be left, so the pull request doesn’t vanish from the board
  const handOverCandidates = parsedEntries.flatMap((entry) => {
    const folder = entry.slug !== parsed.slug && findOtherCollectionFolder(entry, collectionName);

    return folder ? [{ entry, folder }] : [];
  });

  const handedOver = handOverCandidates.length < parsedEntries.length ? handOverCandidates : [];
  const handedOverEntries = new Set(handedOver.map(({ entry }) => entry));

  if (handedOver.length) {
    /** @type {Map<string, EntryFolderInfo>} */
    const handedOverFolders = new Map(
      handedOver.flatMap(({ entry, folder }) => getEntryPaths(entry).map((path) => [path, folder])),
    );

    entryFiles = entryFiles.map((file) => {
      const folder = handedOverFolders.get(file.path);

      return folder ? { ...file, folder } : file;
    });

    targetFiles = targetFiles.filter(({ path }) => !handedOverFolders.has(path));
  }

  // Other entries of the collection the CMS rewrote along with the entry are left out
  const ownEntries = targetFiles.length
    ? findOwnEntries({
        entries: parsedEntries.filter((entry) => !handedOverEntries.has(entry)),
        slug: parsed.slug,
        pullRequest,
        previousPaths,
      })
    : [];

  // A pull request that only removes entry files has nothing to parse, so reuse the published entry
  // it touches. When it deletes all the entry’s files, it’s an Unpublish, and the published content
  // is what the list and the editor display while the removal awaits publication. Otherwise it only
  // deletes the files of locales turned off for the entry: it’s an edit without those locales. The
  // other files of the collection it may carry are those of the entries a removal rewrites.
  if (!ownEntries.length) {
    const removedPaths = new Set(previousPaths);

    const removedEntries = previousPaths.length
      ? allEntries.current.filter((entry) =>
          Object.values(entry.locales).some(({ path }) => removedPaths.has(path)),
        )
      : [];

    return {
      entries: removedEntries.map((entry) => {
        const remainingLocales = Object.entries(entry.locales).filter(
          ([, { path }]) => !deletedPaths.has(path),
        );

        if (remainingLocales.length) {
          return {
            ...entry,
            locales: Object.fromEntries(remainingLocales),
            workflow: createUnpublishedEntryProps({
              pullRequest,
              collectionName,
              fileName: vacatedEntryFiles[0].folder.fileName,
              previousPaths,
            }),
          };
        }

        return {
          ...entry,
          workflow: {
            pullRequest,
            // A removal opened before the dedicated status existed carries `pending_publish`, so
            // the status is taken from the contents rather than the label
            status: /** @type {WorkflowStatus} */ ('pending_deletion'),
            collectionName,
            fileName: undefined,
            previousPaths,
          },
        };
      }),
      assets,
    };
  }

  const ownPaths = new Set(ownEntries.flatMap((entry) => getEntryPaths(entry)));
  const ownFile = targetFiles.find(({ path }) => ownPaths.has(path)) ?? targetFiles[0];
  const { fileName } = ownFile.folder;
  const companions = await parseCompanions(entryFiles, collectionName, deletedPaths);

  return {
    entries: ownEntries.map((entry) => ({
      ...completeEntry({ entry, previousPaths, deletedPaths, collectionName, fileName }),
      workflow: createUnpublishedEntryProps({
        pullRequest,
        collectionName,
        fileName,
        previousPaths,
        companions,
      }),
    })),
    assets,
  };
};

/**
 * Convert all the given pull requests to entries and assets.
 * @param {WorkflowPullRequest[]} pullRequests Pull requests.
 * @returns {Promise<PullRequestContents>} Entries and assets.
 */
export const convertPullRequests = async (pullRequests) => {
  const results = await Promise.all(pullRequests.map(convertPullRequest));

  return {
    entries: results.flatMap(({ entries }) => entries),
    assets: results.flatMap(({ assets }) => assets),
  };
};
