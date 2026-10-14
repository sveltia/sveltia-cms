import { deleteEntries } from '$lib/services/contents/collection/data/delete';
import { cancelBackup, deleteBackup } from '$lib/services/contents/draft/backup';
import { deleteWorkflowEntries, discardWorkflowEntries } from '$lib/services/workflow/save';

/**
 * @import {
 * Asset,
 * Entry,
 * InternalCollection,
 * InternalCollectionFile,
 * UnpublishedEntry,
 * UpdateToastState,
 * } from '$lib/types/private';
 */

/**
 * Delete the draft backups of the given entries, which are gone or about to be. A backup is stored
 * under the collection name and the entry slug, so one left behind would be offered to restore to
 * a new entry created with the same slug. A backup scheduled for a change made just before the
 * deletion is dropped as well, so it doesn’t take the place of the one deleted here. The entries
 * are deleted already, so a backup that can’t be deleted doesn’t fail the deletion.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries Deleted or discarded entries.
 * @param {InternalCollection} [args.collection] Collection the entries belong to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file, if the entry is one.
 */
const deleteBackups = async ({ entries, collection, collectionFile }) => {
  cancelBackup();

  if (!collection) {
    return;
  }

  await Promise.all(
    entries.map(async ({ slug }) => {
      try {
        // Same as `getBackupSlug()`: a collection file’s backup is stored under the file name
        await deleteBackup(collection.name, collectionFile?.name ?? slug);
      } catch (ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }),
  );
};

/**
 * Take the given entries off the site, each in the way that suits it. An unpublished entry that has
 * never been published is discarded by closing its pull request, because there’s nothing on the
 * configured branch to remove. A published entry is deleted through Editorial Workflow when it’s in
 * use, so the removal is reviewed and released like any other change, or committed straight to the
 * configured branch otherwise.
 * @param {object} args Arguments.
 * @param {UnpublishedEntry[]} [args.drafts] Unpublished entries that have never been published.
 * @param {{ entry: Entry, assets: Asset[] }[]} [args.items] Published entries, each with the assets
 * stored alongside it, which are removed with it.
 * @param {InternalCollection} [args.collection] Collection the published entries belong to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file, if the entry is one.
 * @param {boolean} args.useWorkflow Whether the published entries go through Editorial Workflow.
 * @returns {Promise<Partial<UpdateToastState> | undefined>} State of the toast that reports the
 * outcome, or `undefined` if there’s nothing to report, or the deletion has reported it itself.
 * @throws {Error} When a discard or a deletion fails.
 */
export const deleteOrDiscardEntries = async ({
  drafts = [],
  items = [],
  collection = undefined,
  collectionFile = undefined,
  useWorkflow,
}) => {
  /**
   * Discard the drafts. It’s done after the published entries are deleted, which may ask the user
   * for a commit message: cancelling it then leaves the whole selection as it was.
   */
  const discardDrafts = async () => {
    if (drafts.length) {
      await discardWorkflowEntries(drafts);
      await deleteBackups({ entries: drafts, collection, collectionFile });
    }
  };

  if (items.length) {
    const entries = items.map(({ entry }) => entry);

    if (useWorkflow && collection) {
      // Committing the removals straight to the configured branch would bypass review and be
      // rejected outright when the branch is protected
      // @see https://github.com/decaporg/decap-cms/issues/6610
      await deleteWorkflowEntries(
        items.map(({ entry, assets }) => ({ entry, collection, collectionFile, assets })),
      );
      // The deletion asked for drops the unsaved changes as well
      await deleteBackups({ entries, collection, collectionFile });
      await discardDrafts();

      // The entries stay on the site until the deletion is published
      return { deleted: true, deletionPending: true, count: items.length };
    }

    // `deleteEntries()` reports the outcome itself
    await deleteEntries(
      entries,
      items.flatMap(({ assets }) => assets),
    );
    await deleteBackups({ entries, collection, collectionFile });
    await discardDrafts();

    return undefined;
  }

  await discardDrafts();

  // Nothing was published, so the entries really are gone
  return drafts.length ? { deleted: true, count: drafts.length } : undefined;
};
