import { allAssets } from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { repositoryHead } from '$lib/services/backends/git/shared/fetch';
import { allEntries } from '$lib/services/contents';
import { productionSHA } from '$lib/services/deployments';

/**
 * @import { Asset, BackendService, Entry, RemoteChanges } from '$lib/types/private';
 */

/**
 * Shortest gap between two checks made in passing, in milliseconds: the tab being focused, or an
 * entry being opened, prompts a check, and doing either a few times in a row shouldn’t send a burst
 * of requests. A save always checks.
 */
export const MIN_CHECK_GAP = 10 * 1000;

/**
 * The check in flight, if any. A second caller gets the same promise rather than a second round of
 * requests.
 * @type {Promise<RemoteChanges | undefined> | undefined}
 */
let pending;
/** When the last check was started, as a Unix timestamp in milliseconds. `0` before the first. */
let lastCheckTime = 0;
/**
 * Number of commits being made. A check isn’t started while one is: the commit is about to put its
 * results into the stores, and a fetch landing after that would replace them with the state of the
 * repository from before the commit.
 */
let commitCount = 0;

/**
 * Work out what a fetch has changed. The fetch keeps every unchanged entry and asset as the same
 * object and carries an entry’s ID over to its changed version, so the two lists can be compared
 * directly.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entriesBefore Entries before the fetch.
 * @param {Asset[]} args.assetsBefore Assets before the fetch.
 * @returns {RemoteChanges} What has changed.
 */
export const diffStores = ({ entriesBefore, assetsBefore }) => {
  const entryIds = new Map(entriesBefore.map((entry) => [entry.id, entry]));
  const assetPaths = new Map(assetsBefore.map((asset) => [asset.path, asset]));
  const entriesAfter = allEntries.current;
  const assetsAfter = allAssets.current;
  const entryIdsAfter = new Set(entriesAfter.map(({ id }) => id));
  const assetPathsAfter = new Set(assetsAfter.map(({ path }) => path));

  return {
    addedEntries: entriesAfter.filter(({ id }) => !entryIds.has(id)),
    modifiedEntries: entriesAfter.filter((entry) => {
      const before = entryIds.get(entry.id);

      return !!before && before !== entry;
    }),
    deletedEntries: entriesBefore.filter(({ id }) => !entryIdsAfter.has(id)),
    addedAssets: assetsAfter.filter(({ path }) => !assetPaths.has(path)),
    modifiedAssets: assetsAfter.filter((asset) => {
      const before = assetPaths.get(asset.path);

      return !!before && before !== asset;
    }),
    deletedAssets: assetsBefore.filter(({ path }) => !assetPathsAfter.has(path)),
  };
};

/**
 * Whether the given changes contain anything.
 * @param {RemoteChanges} changes Changes.
 * @returns {boolean} Result.
 */
const hasChanges = (changes) => Object.values(changes).some((list) => list.length > 0);

/**
 * Ask the backend for the branch head and, if it has moved since the site data was loaded, fetch
 * what has changed into the stores.
 * @param {BackendService} service Backend service.
 * @returns {Promise<RemoteChanges | undefined>} What has changed, or `undefined` if nothing has.
 */
const check = async ({ fetchLastCommit, fetchFiles }) => {
  const { hash } = await /** @type {NonNullable<typeof fetchLastCommit>} */ (fetchLastCommit)();

  if (hash === repositoryHead.current) {
    return undefined;
  }

  const entriesBefore = allEntries.current;
  const assetsBefore = allAssets.current;

  await fetchFiles();

  // The site is now being built from the new head, so that’s the deployment to watch
  productionSHA.current = hash;

  const changes = diffStores({ entriesBefore, assetsBefore });

  return hasChanges(changes) ? changes : undefined;
};

/**
 * Check whether someone else has pushed to the configured branch since the site data was loaded,
 * and if so bring the stores up to date. The check costs one small request when nothing has
 * changed; otherwise the files that have changed are fetched, and the entries and assets already in
 * the stores are kept wherever they still apply, so the app doesn’t lose track of them.
 *
 * Nothing is checked while a commit is being made, or for a backend that can’t tell — the local
 * backend has no commits to compare.
 * @param {object} [options] Options.
 * @param {number} [options.maxAge] Skip the check if one was started within this many milliseconds,
 * whoever asked for it. A check made in passing uses {@link MIN_CHECK_GAP}.
 * @returns {Promise<RemoteChanges | undefined>} The entries and assets that have changed, or
 * `undefined` if nothing has, or if no check could be made.
 * @throws {Error} When the backend couldn’t be reached.
 */
export const checkForRemoteChanges = async ({ maxAge = 0 } = {}) => {
  const service = backend.current;

  if (!service?.fetchLastCommit || !repositoryHead.current || commitCount) {
    return undefined;
  }

  if (maxAge && !pending && Date.now() - lastCheckTime < maxAge) {
    return undefined;
  }

  if (!pending) {
    lastCheckTime = Date.now();
    pending = check(service).finally(() => {
      pending = undefined;
    });
  }

  return pending;
};

/**
 * Run a commit, holding off any check for remote changes until its results are in the stores. A
 * check already in flight is waited for first, so it can’t land in the middle either.
 * @template T
 * @param {() => Promise<T>} commit Function that makes the commit and updates the stores.
 * @returns {Promise<T>} Whatever the function returns.
 */
export const suspendChecksWhile = async (commit) => {
  // Waiting for the promise is what matters; the result, or a failure, is the other caller’s
  await pending?.catch(() => undefined);

  commitCount += 1;

  try {
    return await commit();
  } finally {
    commitCount -= 1;
  }
};
