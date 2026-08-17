import { allAssets } from '$lib/services/assets';

/**
 * @import { Asset } from '$lib/types/private';
 */

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

  allAssets.update((_allAssets) => {
    // A map keeps the existing order, so a merged asset doesn’t jump to the end of the media
    // library
    const assetMap = new Map(_allAssets.map((asset) => [asset.path, asset]));

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

    return [...assetMap.values()];
  });
};

/**
 * Remove the assets committed to the given workflow branch, restoring any published version they
 * were shadowing. Used when a draft is discarded, as the branch and its files are then gone.
 * @param {string} branch Workflow branch name.
 */
export const removeWorkflowAssets = (branch) => {
  allAssets.update((_allAssets) =>
    _allAssets.flatMap((asset) =>
      asset.workflow?.branch === branch ? (asset.workflow.replacedAsset ?? []) : asset,
    ),
  );
};

/**
 * Clear the Editorial Workflow information from the assets committed to the given branch, as they
 * now exist on the configured branch. Used when a draft is published.
 * @param {string} branch Workflow branch name.
 */
export const publishWorkflowAssets = (branch) => {
  allAssets.update((_allAssets) =>
    _allAssets.map((asset) => {
      if (asset.workflow?.branch !== branch) {
        return asset;
      }

      const { workflow: _workflow, ...publishedAsset } = asset;

      return publishedAsset;
    }),
  );
};
