import { _ } from '@sveltia/i18n';

import { toUpstreamBranchName } from '$lib/services/workflow/branch';

/**
 * @import { Entry, ForkHead, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Character that separates the fork from the branch name in the name a fork request’s branch is
 * known by. Git doesn’t allow it in a ref name, so the name can’t be mistaken for a branch of the
 * configured repository: a request that still sends it to the Git service as a ref is refused
 * rather than carried out on a branch of the same name there.
 * @see https://git-scm.com/docs/git-check-ref-format
 */
const SEPARATOR = ':';

/**
 * Get the name a pull request opened from a fork is known by in the CMS, which qualifies its head
 * branch with the fork, e.g. `alice/website:cms/posts/hello`. Contributors working on forks name
 * their branches after the entries just like the CMS does, so the same branch name can be in use in
 * the configured repository and in any number of forks at once; the entries are told apart by it.
 * @param {object} args Arguments.
 * @param {string} args.owner Owner of the fork.
 * @param {string} args.repo Name of the fork.
 * @param {string} args.branch Head branch name in the fork.
 * @returns {string} Qualified branch name.
 */
export const getForkBranchName = ({ owner, repo, branch }) =>
  `${owner}/${repo}${SEPARATOR}${branch}`;

/**
 * Parse a name given by {@link getForkBranchName}. The owner can be a namespace of its own, like a
 * GitLab group with subgroups, e.g. `acme/docs/website:cms/posts/hello`, so the fork’s name is
 * whatever follows its last slash.
 * @param {string} name Branch name.
 * @returns {{ owner: string, repo: string, branch: string } | undefined} Fork and branch, or
 * `undefined` if the name is that of a branch in the repository holding the workflow branches.
 */
export const parseForkBranchName = (name) => {
  const index = name.indexOf(SEPARATOR);

  if (index < 0) {
    return undefined;
  }

  const path = name.slice(0, index);
  const slash = path.lastIndexOf('/');
  const owner = path.slice(0, slash);
  const repo = path.slice(slash + 1);
  const branch = name.slice(index + 1);

  if (slash < 0 || !repo || !branch || owner.split('/').some((segment) => !segment)) {
    return undefined;
  }

  return { owner, repo, branch };
};

/**
 * Get the name a workflow branch would have in the configured repository, which is how the
 * collection and the entry are read from it. A contributor’s branch is known by a name qualified
 * with the fork (see {@link getForkBranchName}), and Open Authoring inserts the fork’s path after
 * the prefix, as Netlify/Decap CMS does, so both are taken off: `alice/website:cms/alice/website/
 * posts/hello` becomes `cms/posts/hello`. See {@link toUpstreamBranchName}.
 * @param {string} name Branch name as the CMS knows it.
 * @returns {string} Branch name.
 */
export const getUpstreamBranchName = (name) => {
  const fork = parseForkBranchName(name);

  return fork ? toUpstreamBranchName(fork.branch, fork) : name;
};

/**
 * Get the fork the given entry’s pull request comes from, if it’s one a contributor opened from
 * their fork and the signed-in user is reviewing it as a maintainer.
 * @param {Entry | null | undefined} entry Entry, published or not.
 * @returns {ForkHead | undefined} Fork, or `undefined` if the entry isn’t from a fork.
 */
export const getForkHead = (entry) =>
  /** @type {UnpublishedEntry | undefined} */ (entry)?.workflow?.pullRequest?.fork;

/**
 * Check whether the given entry comes from a pull request a contributor opened from their fork.
 * Such an entry is only reached from the Editorial Workflow board: the rest of the CMS keeps
 * showing the published version, or the maintainers’ own pull request, so a maintainer editing an
 * entry never commits to a contributor’s branch without meaning to, and a contributor can’t take an
 * entry over by opening a pull request for it.
 * @param {Entry | null | undefined} entry Entry, published or not.
 * @returns {boolean} Result.
 */
export const isForkEntry = (entry) => !!getForkHead(entry);

/**
 * Check whether the given fork’s pull request doesn’t let maintainers push to its branch, in which
 * case its entry can only be viewed.
 * @param {ForkHead | undefined} fork Fork, or `undefined` for a pull request not from a fork.
 * @returns {boolean} Result.
 */
export const isLockedFork = (fork) => fork?.editable === false;

/**
 * Check whether the given entry comes from a fork whose pull request doesn’t let maintainers push
 * to its branch, in which case it can only be viewed. See {@link isLockedFork}.
 * @param {Entry | null | undefined} entry Entry, published or not.
 * @returns {boolean} Result.
 */
export const isLockedForkEntry = (entry) => isLockedFork(getForkHead(entry));

/**
 * Get the message the editor shows for an entry from a fork, which says where a save goes, or why
 * the entry can’t be saved.
 * @param {Entry | null | undefined} entry Entry being edited.
 * @returns {string | undefined} Message, or `undefined` if the entry isn’t from a fork.
 */
export const getForkEntryNotice = (entry) => {
  const fork = getForkHead(entry);

  if (!fork) {
    return undefined;
  }

  const values = { fork: `${fork.owner}/${fork.repo}` };

  return fork.editable
    ? _('workflow.fork_entry_editable', { values })
    : _('workflow.fork_entry_locked', { values });
};
