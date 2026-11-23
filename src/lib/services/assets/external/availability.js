import { getExternalAssetDetails } from '$lib/services/assets/external/details';
import { isMediaKind } from '$lib/services/assets/kinds';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { ExternalAsset } from '$lib/types/private';
 */

/**
 * Maximum number of checks in flight at the same time. The linked files can be on many hosts, but
 * a site typically links to a few, so a burst of requests to one of them is kept small.
 */
const CONCURRENCY = 6;

/**
 * Whether the files linked from entries could be loaded, keyed by asset ID, which is the URL. A
 * file is `false` when it couldn’t be loaded, e.g. because it has been deleted (404) or its host is
 * gone, so it can stand out in the Asset Library. A file that hasn’t been checked, or whose host
 * doesn’t answer cross-origin requests so nothing is known about it, has no entry.
 * @type {{ current: Record<string, boolean> }}
 */
export const externalAssetAvailability = createRawState({});

/**
 * IDs of the assets checked or queued so far. A file is checked once per session, like the media
 * info gathered for the Info pane, so listing the linked files again doesn’t hit every host again.
 * @type {Set<string>}
 */
const checkedIds = new Set();

/* v8 ignore next 5 */
/**
 * Reset the availability state and the pending checks. This is used in tests to reset the state
 * between tests.
 */
export const _resetExternalAssetAvailability = () => {
  externalAssetAvailability.current = {};
  checkedIds.clear();
};

/**
 * Check whether the file at the given URL exists, using a `HEAD` request. Unlike loading the file
 * in a media element, this reports the HTTP status, but only if the host allows cross-origin
 * requests.
 * @param {string} url File URL.
 * @returns {Promise<boolean | undefined>} `true` if the file exists, `false` if it can’t be loaded,
 * or `undefined` if the host doesn’t say either way.
 */
export const probeURL = async (url) => {
  try {
    const { ok, status } = await fetch(url, { method: 'HEAD' });

    if (ok) {
      return true;
    }

    // Any client or server error means the file can’t be loaded, unless the server just doesn’t
    // answer `HEAD` requests (405 Method Not Allowed, 501 Not Implemented) or is throttling the
    // requests (429 Too Many Requests), in which case the file may well be fine
    if (status >= 400 && ![405, 429, 501].includes(status)) {
      return false;
    }

    return undefined;
  } catch {
    // A cross-origin request is rejected by the browser whatever the status if the host doesn’t
    // allow it, so the failure tells nothing yet. An opaque request goes through regardless, as
    // long as the host can be reached at all, so a failure of that means the host is gone
    try {
      await fetch(url, { method: 'HEAD', mode: 'no-cors' });

      return undefined;
    } catch {
      return false;
    }
  }
};

/**
 * Whether the given URL is blocked as mixed content: an `http:` file can’t be loaded by any means
 * from a CMS served over `https:`, however fine the file is, so nothing can be said about it.
 * @param {string} url File URL.
 * @returns {boolean} Result.
 */
export const isMixedContent = (url) =>
  window.location.protocol === 'https:' && url.startsWith('http:');

/**
 * Check whether the given asset can be loaded. A media file is loaded in a media element, which
 * works on any host, and only falls back to a `HEAD` request when it can’t be decoded, to tell a
 * missing file from one in a format the browser doesn’t support. Any other file can only be
 * checked with a request.
 * @param {ExternalAsset} asset Asset.
 * @returns {Promise<boolean | undefined>} `true` if the file can be loaded, `false` if it can’t,
 * or `undefined` if the host doesn’t say either way.
 */
export const checkExternalAssetAvailability = async (asset) => {
  const { kind, downloadURL } = asset;

  if (isMixedContent(downloadURL)) {
    return undefined;
  }

  if (isMediaKind(kind)) {
    const details = await getExternalAssetDetails(asset);

    if ('dimensions' in details || 'duration' in details) {
      return true;
    }

    // The file exists if the host says so; otherwise it couldn’t be loaded either way
    return (await probeURL(downloadURL)) === true;
  }

  return probeURL(downloadURL);
};

/**
 * Check whether the given assets can be loaded, and record the results in
 * {@link externalAssetAvailability} as they come in. An asset that has already been checked, or is
 * being checked, is skipped.
 * @param {ExternalAsset[]} assets Assets.
 * @returns {Promise<void>} Resolves once all the checks are done.
 */
export const checkExternalAssetsAvailability = async (assets) => {
  const unchecked = assets.filter(({ id }) => !checkedIds.has(id));

  // Mark the whole batch before the first check starts, so that a list requested again in the
  // meantime doesn’t queue the same files twice
  unchecked.forEach(({ id }) => checkedIds.add(id));

  await runConcurrently(
    unchecked,
    async (asset) => {
      const available = await checkExternalAssetAvailability(asset);

      if (available !== undefined) {
        externalAssetAvailability.current = {
          ...externalAssetAvailability.current,
          [asset.id]: available,
        };
      }
    },
    { concurrency: CONCURRENCY },
  );
};
