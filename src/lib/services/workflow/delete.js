import { deleteEntries } from '$lib/services/contents/collection/data/delete';
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
  if (drafts.length) {
    await discardWorkflowEntries(drafts);
  }

  if (items.length) {
    if (useWorkflow && collection) {
      // Committing the removals straight to the configured branch would bypass review and be
      // rejected outright when the branch is protected
      // @see https://github.com/decaporg/decap-cms/issues/6610
      await deleteWorkflowEntries(
        items.map(({ entry, assets }) => ({ entry, collection, collectionFile, assets })),
      );

      // The entries stay on the site until the deletion is published
      return { deleted: true, deletionPending: true, count: items.length };
    }

    // `deleteEntries()` reports the outcome itself
    await deleteEntries(
      items.map(({ entry }) => entry),
      items.flatMap(({ assets }) => assets),
    );

    return undefined;
  }

  // Nothing was published, so the entries really are gone
  return drafts.length ? { deleted: true, count: drafts.length } : undefined;
};
