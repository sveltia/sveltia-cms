import { removeVisibilityResolver } from '@sveltia/utils/element';

import { holdViewTransition } from '$lib/services/app/navigation';
import { revokeAssetBlobURLIfNeeded, revokeBlobURLIfNeeded } from '$lib/services/assets/info';
import { whenThumbnailShown } from '$lib/services/utils/visibility';

/**
 * @import { Asset } from '$lib/types/private';
 */

/**
 * Functions managing the lifecycle of an asset preview.
 * @typedef {object} PreviewLifecycle
 * @property {boolean} destroyed Whether the preview has been removed.
 * @property {(asset: Asset | undefined) => void} trackAsset Remember the asset being rendered.
 * @property {(url: string | undefined) => void} ownURL Remember an object URL the preview created.
 * @property {(result: { url?: string, failed: boolean, thumbnail: boolean }) => string | undefined
 * } settleLookup Take in the result of the latest URL lookup.
 * @property {(element: HTMLElement) => Promise<void>} waitForThumbnail Wait until the given
 * thumbnail is to be shown.
 * @property {() => void} holdTransition Make the running view transition wait.
 * @property {() => void} releaseTransition Release the view transition being held, if any.
 * @property {(element?: HTMLElement) => void} destroy Release everything.
 */

/**
 * Create what keeps track of what one asset preview holds on to while it’s on screen, and lets go
 * of once it’s removed.
 *
 * This is deliberately a plain module, kept outside the reactive graph, as the `destroy` function
 * runs while the component is being destroyed. Reading the `asset` prop there would read whatever
 * the parent passes it from — a `$derived` holding the thumbnail of a collapsed Object field or
 * List item. Svelte answers a read made while an effect is being torn down by walking that
 * derived’s dependency graph to see whether it has to be recomputed, and that walk doesn’t memoize:
 * in a deeply nested entry editor, where every level multiplies the number of paths to the same
 * derived, expanding one field froze the browser for tens of seconds.
 * @returns {PreviewLifecycle} Functions to manage the lifecycle.
 * @see https://github.com/sveltia/sveltia-cms/issues/1006
 */
export const createPreviewLifecycle = () => {
  /**
   * Object URLs created by this preview. Every `getAssetThumbnailURL()` call returns a URL of its
   * own, so these have to be released here — `revokeAssetBlobURLIfNeeded()` only knows about the
   * one URL shared on the asset itself.
   * @type {string[]}
   */
  const ownedURLs = [];
  /**
   * The URL the last lookup has found, to be released once it’s been replaced. The component’s own
   * source URL can’t tell, as it’s reset as soon as the asset changes.
   * @type {string | undefined}
   */
  let lookedUpSrc = undefined;
  /** @type {Asset | undefined} */
  let currentAsset = undefined;
  let destroyed = false;
  /** @type {(() => void) | undefined} */
  let resolveTransition = undefined;
  /** @type {(() => void) | undefined} */
  let cancelThumbnailWait = undefined;

  /**
   * Remember an object URL this preview created.
   * @param {string | undefined} url Object URL.
   */
  const ownURL = (url) => {
    if (url && !ownedURLs.includes(url)) {
      ownedURLs.push(url);
    }
  };

  /**
   * Release an object URL this preview created, once no element is displaying it any more.
   * @param {string | undefined} url Object URL.
   */
  const releaseOwnedURL = (url) => {
    const index = url ? ownedURLs.indexOf(url) : -1;

    if (index > -1) {
      ownedURLs.splice(index, 1);
      revokeBlobURLIfNeeded(url);
    }
  };

  /**
   * Release the view transition being held, if any.
   */
  const releaseTransition = () => {
    resolveTransition?.();
    resolveTransition = undefined;
  };

  /**
   * Remember the asset being rendered, for {@link destroy} to release.
   * @param {Asset | undefined} asset Asset.
   */
  const trackAsset = (asset) => {
    currentAsset = asset;
  };

  /**
   * Take in the result of the latest URL lookup, and release the URL it replaces.
   * @param {object} result Result of the lookup.
   * @param {string} [result.url] URL found.
   * @param {boolean} result.failed Whether the lookup has failed.
   * @param {boolean} result.thumbnail Whether the URL is a thumbnail, which the preview owns, as
   * opposed to the full-size URL shared on the asset.
   * @returns {string | undefined} The URL the preview ends up with, which is the previous one if
   * the lookup has failed.
   */
  const settleLookup = ({ url, failed, thumbnail }) => {
    const previousSrc = lookedUpSrc;
    const nextSrc = failed ? previousSrc : url;

    lookedUpSrc = nextSrc;

    if (thumbnail) {
      ownURL(nextSrc);
    }

    if (previousSrc !== nextSrc) {
      releaseOwnedURL(previousSrc);
    }

    return nextSrc;
  };

  /**
   * Wait until the given thumbnail is to be shown: right away if it’s in view, or once it has
   * scrolled into view and stayed there for a moment. A thumbnail in a grid being scrolled quickly
   * then doesn’t queue its generation ahead of the ones the user stops at, and no layout is forced
   * to find out, which matters with a thumbnail per tile. The promise is left pending if another
   * wait starts or the preview is removed first: only the latest lookup is acted on, and an earlier
   * wait isn’t left to observe the same element alongside this one.
   * @param {HTMLElement} element Element.
   * @returns {Promise<void>} Promise resolved once the thumbnail is to be shown.
   */
  const waitForThumbnail = (element) =>
    new Promise((resolve) => {
      cancelThumbnailWait?.();
      cancelThumbnailWait = whenThumbnailShown(element, () => {
        cancelThumbnailWait = undefined;
        resolve();
      });
    });

  /**
   * Make the running view transition wait until {@link releaseTransition} is called, replacing an
   * earlier hold.
   */
  const holdTransition = () => {
    releaseTransition();

    const { promise, resolve } = /** @type {PromiseWithResolvers<void>} */ (
      Promise.withResolvers()
    );

    resolveTransition = resolve;
    holdViewTransition(promise);
  };

  /**
   * Release everything once the preview is removed.
   * @param {HTMLElement} [element] Media element.
   */
  const destroy = (element) => {
    destroyed = true;
    releaseTransition();

    if (currentAsset) {
      revokeAssetBlobURLIfNeeded(currentAsset);
    }

    // The revocation is batched into the next frame and skips any URL an element is still
    // displaying, which is what keeps an image that hasn’t finished decoding — or one that outlives
    // this component — from losing its source. @see
    // https://github.com/sveltia/sveltia-cms/issues/944
    ownedURLs.splice(0).forEach((url) => {
      revokeBlobURLIfNeeded(url);
    });

    if (element) {
      removeVisibilityResolver(element);
    }

    cancelThumbnailWait?.();
  };

  return {
    /**
     * Whether the preview has been removed. A URL lookup that finishes afterwards releases what it
     * created, as {@link destroy} has already run.
     * @returns {boolean} Result.
     */
    get destroyed() {
      return destroyed;
    },
    trackAsset,
    ownURL,
    settleLookup,
    waitForThumbnail,
    holdTransition,
    releaseTransition,
    destroy,
  };
};
