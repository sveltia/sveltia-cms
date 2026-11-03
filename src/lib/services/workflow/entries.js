import { parseAssetFileInfo } from '$lib/services/backends/git/shared/parse-files';
import { toFileListItem } from '$lib/services/backends/git/shared/tree';
import { createFileList } from '$lib/services/backends/process';
import { isInRootDir } from '$lib/services/backends/root-dir';
import { isReadonly } from '$lib/services/config/readonly';
import { allEntries, findEntryByPaths } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
import { isEntryEditableAlong } from '$lib/services/contents/entry/editable';
import { getEntryPaths } from '$lib/services/contents/entry/paths';
import { prepareEntries } from '$lib/services/contents/file/process';
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
 * WorkflowStatus,
 * UnpublishedEntry,
 * WorkflowPullRequest,
 * } from '$lib/types/private';
 */

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
   * Get the given entry collection, which the files are filtered for below.
   * @param {string} name Collection name.
   * @returns {InternalEntryCollection} Collection.
   */
  const getEntryCollection = (name) => /** @type {InternalEntryCollection} */ (getCollection(name));
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
 * Contents of one or more pull requests.
 * @typedef {object} PullRequestContents
 * @property {UnpublishedEntry[]} entries Unpublished entries.
 * @property {Asset[]} assets Assets committed along with the entries. These only exist on the
 * workflow branch until the entries are published.
 */

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

  const { entryFiles, assetFiles } = createFileList(files);

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
    ? createFileList(vacatedPaths.map((path) => toFileListItem(path))).entryFiles.filter(
        ({ folder }) => folder.collectionName === collectionName,
      )
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
  const targetFiles = entryFiles.filter(
    ({ folder, text }) => folder.collectionName === collectionName && text !== undefined,
  );

  // A pull request that only removes entry files has nothing to parse, so reuse the published entry
  // it touches. When it deletes all the entry’s files, it’s an Unpublish, and the published content
  // is what the list and the editor display while the removal awaits publication. Otherwise it only
  // deletes the files of locales turned off for the entry: it’s an edit without those locales.
  if (!targetFiles.length) {
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
            workflow: {
              pullRequest,
              status: pullRequest.status,
              collectionName,
              fileName: vacatedEntryFiles[0].folder.fileName,
              previousPaths,
            },
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

  const { entries } = await prepareEntries(targetFiles);
  const { fileName } = targetFiles[0].folder;
  const companions = await parseCompanions(entryFiles, collectionName, deletedPaths);

  return {
    entries: entries.map((entry) => ({
      ...completeEntry({ entry, previousPaths, deletedPaths, collectionName, fileName }),
      workflow: {
        pullRequest,
        status: pullRequest.status,
        collectionName,
        fileName,
        previousPaths,
        ...(companions.length ? { companions } : {}),
      },
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
