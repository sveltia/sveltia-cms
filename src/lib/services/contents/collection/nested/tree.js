import { compare } from '@sveltia/utils/string';

import {
  DEFAULT_INDEX_FILE_NAMES,
  getEntryDirPath,
  getNestedConfig,
  getSharedEntryFileName,
} from '$lib/services/contents/collection/nested';
import { getEntrySummary } from '$lib/services/contents/entry/summary';

/**
 * @import { Entry, InternalCollection, InternalLocaleCode } from '$lib/types/private';
 */

/**
 * A folder within a nested collection, shown as an item in the collection tree.
 * @typedef {object} NestedTreeNode
 * @property {string} path Directory path relative to the collection folder, without leading and
 * trailing slashes.
 * @property {string} label Human-readable label.
 * @property {NestedTreeNode[]} children Child folders, sorted by label.
 */

/**
 * Get the path of the parent folder.
 * @param {string} path Folder path relative to the collection folder.
 * @returns {string} Parent path, or an empty string if the folder is at the top level.
 */
const getParentPath = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/**
 * Rate how well an entry represents the folder it’s stored in, so a folder that holds more than one
 * entry is labelled with its index file rather than with whichever entry happens to come first.
 * @param {string} fileName Entry’s file name, without an extension.
 * @param {string | undefined} indexFileName Configured index file name, if any.
 * @returns {number} `2` for a folder’s own entry, `1` for a usable fallback, `0` for an entry that
 * must not label the folder.
 * @see https://github.com/decaporg/decap-cms/issues/7651
 */
const getIndexEntryRank = (fileName, indexFileName) => {
  if (indexFileName) {
    return fileName === indexFileName ? 2 : 0;
  }

  return DEFAULT_INDEX_FILE_NAMES.includes(fileName) ? 2 : 1;
};

/**
 * Collect every folder that holds an entry, along with all of their ancestors, and remember the
 * entry that gives each folder its label.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries Entries in the collection.
 * @param {string | undefined} args.indexFileName Shared index file name, if configured.
 * @param {boolean} args.subfolders Whether the collection uses the `subfolders` mode.
 * @returns {Map<string, Entry | undefined>} Key is a folder path, value is the folder’s index
 * entry, which is only looked up in the `subfolders` mode.
 */
const collectFolders = ({ entries, indexFileName, subfolders }) => {
  /** @type {Map<string, Entry | undefined>} */
  const folders = new Map();
  /** @type {Map<string, number>} */
  const ranks = new Map();

  entries.forEach((entry) => {
    const dirPath = getEntryDirPath(entry.subPath);

    if (!dirPath) {
      return;
    }

    if (subfolders) {
      const fileName = entry.subPath.slice(dirPath.length + 1);
      const rank = getIndexEntryRank(fileName, indexFileName);

      if (rank > (ranks.get(dirPath) ?? 0)) {
        ranks.set(dirPath, rank);
        folders.set(dirPath, entry);
      } else if (!folders.has(dirPath)) {
        folders.set(dirPath, undefined);
      }
    } else if (!folders.has(dirPath)) {
      folders.set(dirPath, undefined);
    }

    // Register the ancestors, which don’t necessarily hold an entry of their own
    let ancestorPath = getParentPath(dirPath);

    while (ancestorPath && !folders.has(ancestorPath)) {
      folders.set(ancestorPath, undefined);
      ancestorPath = getParentPath(ancestorPath);
    }
  });

  return folders;
};

/**
 * Get the label for a folder in the collection tree.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {string} args.path Folder path.
 * @param {Entry | undefined} args.indexEntry Entry that represents the folder, if any.
 * @param {string | undefined} args.summaryTemplate Summary template from the `nested.summary`
 * option.
 * @param {InternalLocaleCode} [args.locale] Locale to label the folder in. Defaults to the default
 * locale.
 * @returns {string} Label.
 */
const getNodeLabel = ({ collection, path, indexEntry, summaryTemplate, locale }) => {
  const folderName = path.slice(path.lastIndexOf('/') + 1);

  if (!indexEntry) {
    return folderName;
  }

  return (
    getEntrySummary(collection, indexEntry, {
      locale,
      useTemplate: true,
      template: summaryTemplate,
    }) || folderName
  );
};

/**
 * Build a folder tree for a nested collection.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {Entry[]} args.entries Entries in the collection.
 * @param {boolean} args.pruneLeaves Whether to leave out a folder that has no subfolder of its own.
 * @param {string} [args.excludePath] Folder to leave out along with everything below it.
 * @param {InternalLocaleCode} [args.locale] Locale to label the folders in.
 * @returns {NestedTreeNode[]} Top-level folders, sorted by label. An empty array if the collection
 * is not a nested collection or has no folder to show.
 */
const buildTree = ({ collection, entries, pruneLeaves, excludePath, locale }) => {
  const config = getNestedConfig(collection);

  if (!config) {
    return [];
  }

  const { summary: summaryTemplate, subfolders } = config;
  const indexFileName = getSharedEntryFileName(collection);
  const folders = collectFolders({ entries, indexFileName, subfolders });
  /** @type {Map<string, string[]>} */
  const childPaths = new Map();

  [...folders.keys()].forEach((path) => {
    const parentPath = getParentPath(path);

    childPaths.set(parentPath, [...(childPaths.get(parentPath) ?? []), path]);
  });

  /**
   * Recursively build the nodes for the given folder’s children.
   * @param {string} parentPath Parent folder path.
   * @returns {NestedTreeNode[]} Child nodes.
   */
  const buildNodes = (parentPath) =>
    (childPaths.get(parentPath) ?? [])
      .filter(
        (path) =>
          // A leaf folder in the `subfolders` mode is an entry, not a container
          (!pruneLeaves || !subfolders || !!childPaths.get(path)?.length) && path !== excludePath,
      )
      .map((path) => ({
        path,
        label: getNodeLabel({
          collection,
          path,
          indexEntry: folders.get(path),
          summaryTemplate,
          locale,
        }),
        children: buildNodes(path),
      }))
      .sort((a, b) => compare(a.label, b.label));

  return buildNodes('');
};

/**
 * Build the folder tree shown below a nested collection in the primary sidebar. Only folders are
 * included; the entries themselves are listed in the main area once a folder is selected.
 *
 * In the default `subfolders` mode, a folder that has no subfolder of its own is left out, because
 * such a folder is an entry rather than a container: it holds nothing but its own index file, and
 * it’s already listed in its parent folder’s entry list.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {Entry[]} args.entries Entries in the collection.
 * @returns {NestedTreeNode[]} Top-level folders, sorted by label. An empty array if the collection
 * is not a nested collection or has no subfolder.
 */
export const getNestedTree = ({ collection, entries }) =>
  buildTree({ collection, entries, pruneLeaves: true });

/**
 * Build the folder tree offered by the entry path editor, which lists every folder an entry can be
 * filed in. Unlike the sidebar tree, a folder that holds nothing but its own entry is included,
 * because an entry can be filed below any other entry.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {Entry[]} args.entries Entries in the collection.
 * @param {string} [args.excludePath] Folder to leave out along with everything below it, so an
 * entry can’t be filed within itself.
 * @param {InternalLocaleCode} [args.locale] Locale to label the folders in, which is the locale of
 * the pane showing the tree. A folder is labelled with its entry’s summary, so with localized
 * content each pane names the folders in its own language.
 * @returns {NestedTreeNode[]} Top-level folders, sorted by label.
 */
export const getParentFolderTree = ({ collection, entries, excludePath, locale }) =>
  buildTree({ collection, entries, pruneLeaves: false, excludePath, locale });

/**
 * Add a folder that holds no entry yet to a tree, creating any missing folders above it, so that it
 * can be chosen with the parent folder picker before anything is stored in it. A folder is labelled
 * with its own name here, because a label of its own only comes from the entry it holds.
 * @param {object} args Arguments.
 * @param {NestedTreeNode[]} args.nodes Folders at the top level of the tree.
 * @param {string} args.path Folder path relative to the collection folder.
 * @returns {NestedTreeNode[]} Folders at the top level, with the new one in place and each level
 * sorted by label. The tree is returned unchanged if the folder is already in it, or if the path is
 * empty, which is the collection folder itself.
 */
export const addFolderToTree = ({ nodes, path }) => {
  const segments = path.split('/').filter(Boolean);

  /**
   * Put the next segment in place among the given folders, recursing until the path runs out.
   * @param {NestedTreeNode[]} siblings Folders sharing a parent.
   * @param {string[]} remainingSegments Segments still to be added.
   * @param {string} parentPath Path of the folder holding the siblings.
   * @returns {NestedTreeNode[]} Folders sharing a parent, with the segment in place.
   */
  const addSegment = (siblings, [name, ...remaining], parentPath) => {
    const nodePath = parentPath ? `${parentPath}/${name}` : name;
    const existingNode = siblings.find((node) => node.path === nodePath);

    if (existingNode) {
      // The folder is already there, so only the folders below it can still be missing
      return remaining.length
        ? siblings.map((node) =>
            node === existingNode
              ? { ...node, children: addSegment(node.children, remaining, nodePath) }
              : node,
          )
        : siblings;
    }

    const newNode = {
      path: nodePath,
      label: name,
      children: remaining.length ? addSegment([], remaining, nodePath) : [],
    };

    return [...siblings, newNode].sort((a, b) => compare(a.label, b.label));
  };

  return segments.length ? addSegment(nodes, segments, '') : nodes;
};

/**
 * Look up a folder in a tree by its path.
 * @param {NestedTreeNode[]} nodes Nodes to search, at any level.
 * @param {string} path Folder path relative to the collection folder.
 * @returns {NestedTreeNode | undefined} Found node.
 */
export const findNestedTreeNode = (nodes, path) =>
  nodes.reduce(
    (/** @type {NestedTreeNode | undefined} */ found, node) =>
      found ?? (node.path === path ? node : findNestedTreeNode(node.children, path)),
    undefined,
  );
