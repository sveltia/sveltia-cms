import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';
import { forkedRepository, openAuthoringInitialized } from '$lib/services/workflow/open-authoring';

/**
 * Arguments for {@link fetchRepositoryFiles}.
 * @typedef {Parameters<typeof fetchAndParseFiles>[0] & {
 * isOpenAuthoringConfigured: () => boolean,
 * initOpenAuthoring: () => Promise<void>,
 * }} FetchRepositoryFilesArgs
 */

/**
 * Fetch file list from a backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores, setting the contributor’s fork up first with
 * Open Authoring. A user without write access is then a contributor rather than a stranger, so
 * they’re given a fork to work in instead of being turned away. Setting the fork up may involve the
 * user, so it has to finish before the data is fetched, unlike a plain access check.
 * @param {FetchRepositoryFilesArgs} args Arguments for {@link fetchAndParseFiles}, along with the
 * service’s functions to tell whether Open Authoring is turned on and to set it up. The access
 * checks are only run when they apply.
 */
export const fetchRepositoryFiles = async ({
  isOpenAuthoringConfigured,
  initOpenAuthoring,
  checkAccess,
  checkBranchAccess,
  ...args
}) => {
  const openAuthoring = isOpenAuthoringConfigured();

  // Once only: a later call brings the stores up to date with the repository, and setting the fork
  // up again would reset the fork state while a workflow commit may be relying on it
  if (openAuthoring && !openAuthoringInitialized.current) {
    await initOpenAuthoring();
  }

  await fetchAndParseFiles({
    ...args,
    checkAccess: openAuthoring ? undefined : checkAccess,
    // A contributor’s changes go to their fork, so the branch they can’t push to doesn’t matter
    checkBranchAccess: forkedRepository.current ? undefined : checkBranchAccess,
  });
};
