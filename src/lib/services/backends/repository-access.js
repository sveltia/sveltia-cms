import { createNoAccessError } from '$lib/services/backends/git/shared/errors';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * The configured repository, if the signed-in user can read it but not push to it, e.g. a
 * collaborator with the read or triage role on GitHub, or the Reporter role on GitLab. Such a user
 * can already see the content on the service, so they can sign in, but the whole CMS is read-only,
 * as if the global `readonly` option was `true`. It’s `undefined` when the user can push to the
 * repository, or when the backend doesn’t tell.
 * @type {{ current: string | undefined }}
 */
export const readonlyRepository = createRawState();

/**
 * Record what the signed-in user can do with the configured repository in
 * {@link readonlyRepository}, or refuse them if they can’t even read it.
 * @param {string} repo Repository name.
 * @param {object} access What the user can do.
 * @param {boolean} access.canRead Whether the user can read the repository’s files.
 * @param {boolean} access.canPush Whether the user can push to the repository.
 * @throws {Error} If the user can’t read the repository.
 */
export const recordRepositoryAccess = (repo, { canRead, canPush }) => {
  if (!canRead && !canPush) {
    throw createNoAccessError(repo);
  }

  readonlyRepository.current = canPush ? undefined : repo;
};
