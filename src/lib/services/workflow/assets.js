import { allAssets } from '$lib/services/assets/state';

/**
 * @import { Asset, Entry, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Get the version of the given asset that belongs with the given entry. An asset committed to a
 * workflow branch only exists on that branch, so it’s only the entry of that branch that can use
 * it: any other entry gets the published version it shadows, if there’s one. Otherwise a file that
 * someone pushed to one pull request would be copied into another entry’s commit — when the entry
 * is moved or duplicated — without having been reviewed.
 * @param {Asset | undefined} asset Asset from the asset list.
 * @param {Entry | undefined} entry Entry using the asset, published or not.
 * @returns {Asset | undefined} Asset, or `undefined` if the entry has no version of it.
 */
export const getEntryAssetVersion = (asset, entry) => {
  const branch = asset?.workflow?.branch;

  if (
    !branch ||
    branch === /** @type {UnpublishedEntry | undefined} */ (entry)?.workflow?.pullRequest.branch
  ) {
    return asset;
  }

  return /** @type {Asset} */ (asset).workflow?.replacedAsset;
};

/**
 * Merge assets committed to a workflow branch into the regular asset list, so an image attached to
 * an unpublished entry can be previewed before the entry is published. When an asset shadows a
 * published file at the same path, the published version is kept aside so it can be restored if the
 * draft is discarded.
 * @param {Asset[]} assets Assets to merge. Each one must carry its `workflow.branch`.
 */
export const mergeWorkflowAssets = (assets) => {
  if (!assets.length) {
    return;
  }

  // A map keeps the existing order, so a merged asset doesn’t jump to the end of the media library
  const assetMap = new Map(allAssets.current.map((asset) => [asset.path, asset]));

  assets.forEach((asset) => {
    const existing = assetMap.get(asset.path);

    assetMap.set(asset.path, {
      ...asset,
      workflow: {
        branch: /** @type {string} */ (asset.workflow?.branch),
        // Don’t let a re-save of the same draft overwrite the original published version
        replacedAsset: existing?.workflow ? existing.workflow.replacedAsset : existing,
      },
    });
  });

  allAssets.current = [...assetMap.values()];
};

/**
 * Remove the assets committed to the given workflow branch, restoring any published version they
 * were shadowing. Used when a draft is discarded, as the branch and its files are then gone.
 * @param {string} branch Workflow branch name.
 */
export const removeWorkflowAssets = (branch) => {
  allAssets.current = allAssets.current.flatMap((asset) =>
    asset.workflow?.branch === branch ? (asset.workflow.replacedAsset ?? []) : asset,
  );
};

/**
 * Clear the Editorial Workflow information from the assets committed to the given branch, as they
 * now exist on the configured branch. Used when a draft is published.
 * @param {string} branch Workflow branch name.
 */
export const publishWorkflowAssets = (branch) => {
  allAssets.current = allAssets.current.map((asset) => {
    if (asset.workflow?.branch !== branch) {
      return asset;
    }

    const { workflow: _workflow, ...publishedAsset } = asset;

    return publishedAsset;
  });
};
