/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * Get the key that names an entry for Sveltia CMS Additions, e.g. for its comments: its
 * collection and its file name or path, so the files of an entry with several locales share one
 * key. It leaves out the branch, which the lock key adds.
 * @param {string} collectionName Collection name.
 * @param {string} subPath Entry path without an extension, or the file name of a collection file.
 * @returns {string} Key.
 */
export const getEntryKey = (collectionName, subPath) => `${collectionName}/${subPath}`;

/**
 * Get the key of an entry draft, if it has one: a new entry, which isn’t saved yet, and an item of
 * an entry stored as an array, which shares a file with other entries, don’t.
 * @param {EntryDraft | null | undefined} draft Draft.
 * @returns {string | undefined} Key.
 */
export const getDraftEntryKey = (draft) => {
  if (!draft || draft.isNew || draft.originalEntry?.arrayIndex !== undefined) {
    return undefined;
  }

  const subPath = draft.fileName ?? draft.originalEntry?.subPath;

  return subPath ? getEntryKey(draft.collectionName, subPath) : undefined;
};
