import { getPathInfo } from '@sveltia/utils/file';
import { get } from 'svelte/store';

import { parseAssetFileInfo } from '$lib/services/backends/git/shared/fetch';
import { createFileList } from '$lib/services/backends/process';
import { allEntries } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { parseBranchName } from '$lib/services/workflow/branch';

/**
 * @import {
 * Asset,
 * BaseFileListItemProps,
 * Entry,
 * UnpublishedEntry,
 * WorkflowPullRequest,
 * } from '$lib/types/private';
 */

/**
 * Fill in the parts of an unpublished entry that the pull request doesn’t carry. With the
 * multi-file i18n structure, an entry is spread over one file per locale and only the changed ones
 * are committed, so the rest have to come from the published version. Without them the editor shows
 * the untouched locales as disabled, and an entry whose default locale file isn’t in the pull
 * request has no slug at all, because the slug is read from that file alone.
 * @param {Entry} entry Entry parsed from the pull request.
 * @param {string[]} previousPaths File paths the pull request renamed the entry from.
 * @returns {Entry} Entry with the unchanged locales merged in.
 */
const completeEntry = (entry, previousPaths) => {
  const paths = new Set([
    ...Object.values(entry.locales).map(({ path }) => path),
    ...previousPaths,
  ]);

  // `allEntries` holds the version currently on the configured branch
  const publishedEntry = get(allEntries).find((published) =>
    Object.values(published.locales).some(({ path }) => paths.has(path)),
  );

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
    // The pull request wins for the locales it carries; the others stay as published
    locales: { ...publishedEntry.locales, ...entry.locales },
    slug: renamed ? entry.slug : publishedEntry.slug,
    subPath: renamed ? entry.subPath : publishedEntry.subPath,
  };
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

  if (!parsed) {
    return { entries: [], assets: [] };
  }

  const { collectionName } = parsed;

  const files = /** @type {BaseFileListItemProps[]} */ (
    pullRequest.files
      .filter(({ deleted }) => !deleted)
      .map(({ path, sha, size, text }) => ({
        path,
        sha,
        size,
        text,
        name: getPathInfo(path).basename,
      }))
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

  const previousPaths = vacatedPaths.length
    ? createFileList(
        vacatedPaths.map((path) => ({
          path,
          name: getPathInfo(path).basename,
          sha: '',
          size: 0,
        })),
      )
        .entryFiles.filter(({ folder }) => folder.collectionName === collectionName)
        .map(({ path }) => path)
    : [];

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

  // A pull request that only removes entry files is an Unpublish: there’s nothing to parse, so
  // reuse the published entry it removes. Its content is what the list and the editor display
  // while the removal awaits publication.
  if (!targetFiles.length) {
    const removedPaths = new Set(previousPaths);

    const removedEntries = previousPaths.length
      ? get(allEntries).filter((entry) =>
          Object.values(entry.locales).some(({ path }) => removedPaths.has(path)),
        )
      : [];

    return {
      entries: removedEntries.map((entry) => ({
        ...entry,
        workflow: {
          pullRequest,
          status: pullRequest.status,
          collectionName,
          fileName: undefined,
          previousPaths,
          deletion: true,
        },
      })),
      assets,
    };
  }

  const { entries } = await prepareEntries(targetFiles);
  const { fileName } = targetFiles[0].folder;

  return {
    entries: entries.map((entry) => ({
      ...completeEntry(entry, previousPaths),
      workflow: {
        pullRequest,
        status: pullRequest.status,
        collectionName,
        fileName,
        previousPaths,
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
