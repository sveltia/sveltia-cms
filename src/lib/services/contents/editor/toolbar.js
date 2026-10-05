/**
 * @import { InternalCollection, InternalCollectionFile } from '$lib/types/private';
 * @import { EntryConflict } from '$lib/services/contents/draft/save/conflict';
 */

/**
 * Check whether the entry being edited can be duplicated from the editor options menu.
 * @param {object} args Arguments.
 * @param {InternalCollection} [args.collection] Collection the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file, if the entry is one. A
 * collection file is part of the collection definition, so it can’t be duplicated.
 * @param {boolean} args.isIndexFile Whether the entry is the index file of a nested collection.
 * @param {boolean} args.readonly Whether the entry is read-only.
 * @param {boolean} args.creationDisabled Whether creating new entries is currently disabled.
 * @returns {boolean} Result.
 */
export const canDuplicateEntry = ({
  collection,
  collectionFile,
  isIndexFile,
  readonly,
  creationDisabled,
}) =>
  !readonly &&
  !collectionFile &&
  !isIndexFile &&
  !(collection?._type === 'entry' && collection.duplicate === false) &&
  !creationDisabled;

/**
 * Get which of the menu items that take the entry being edited off the site are offered.
 * @param {object} args Arguments.
 * @param {boolean} args.publishedVersionExists Whether the entry has a published version, which
 * means it’s also under review when it has a pull request.
 * @param {boolean} args.canDeleteEntry Whether the user can delete the entry.
 * @param {boolean} args.isCollectionFile Whether the entry is a collection file, which is part of
 * the collection definition, so it can only be discarded.
 * @param {boolean} args.readonly Whether the entry is read-only.
 * @param {boolean} args.locked Whether the entry’s content can’t be changed: it’s read-only, or
 * awaiting deletion.
 * @returns {{ discard: boolean, delete: boolean }} Whether to offer the item that discards the pull
 * request, or deletes an entry that has never been published, and the one that deletes a published
 * entry under review.
 */
export const getRemovalMenuItems = ({
  publishedVersionExists,
  canDeleteEntry,
  isCollectionFile,
  readonly,
  locked,
}) => ({
  discard: !readonly && (publishedVersionExists || (canDeleteEntry && !isCollectionFile)),
  delete: publishedVersionExists && canDeleteEntry && !isCollectionFile && !locked,
});

/**
 * How a failed save is reported to the user.
 * @typedef {{ type: 'conflict', conflict: EntryConflict } | { type: 'validation' } |
 * { type: 'error', message: string, unexpected: boolean }} SaveFailure
 */

/**
 * Work out how to report the given error thrown while saving an entry: invalid fields are pointed
 * out, someone else’s change to the entry is left for the user to decide on, and anything else is
 * shown as an error, with the backend’s message if there is one. A server error without a message,
 * e.g. a gateway’s HTML error page, leaves only the generic description, rather than the
 * `saving_failed` key.
 * @param {any} ex Error.
 * @returns {SaveFailure} Report. `unexpected` is `true` for an error that doesn’t come from the
 * save itself, which is worth logging.
 */
export const getSaveFailure = (ex) => {
  if (ex.message === 'validation_failed') {
    return { type: 'validation' };
  }

  if (ex.message === 'save_conflict') {
    return { type: 'conflict', conflict: ex.cause };
  }

  if (ex.message === 'saving_failed') {
    return { type: 'error', message: ex.cause?.message ?? '', unexpected: false };
  }

  return { type: 'error', message: '', unexpected: true };
};
