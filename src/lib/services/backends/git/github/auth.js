import { getUserProfile } from '$lib/services/backends/git/github/user';
import { signInToBackend } from '$lib/services/backends/git/shared/auth';
import { cmsConfig } from '$lib/services/config';
import { isWorkflowConfigured } from '$lib/services/workflow/config';

/**
 * @import { SignInOptions, User } from '$lib/types/private';
 */

/**
 * Get the URL of the page for creating a new Personal Access Token (PAT) on GitHub. The permissions
 * the CMS needs are pre-filled, so a user who follows the link gets a token that works.
 * @param {string} repoURL Repository URL, e.g. `https://github.com/owner/repo`.
 * @returns {string} URL to create a new PAT.
 * @see https://github.blog/changelog/2025-08-26-template-urls-for-fine-grained-pats-and-updated-permissions-ui/
 * @see https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
 */
export const getTokenPageURL = (repoURL) => {
  const { origin } = new URL(repoURL);

  const params = new URLSearchParams({
    name: 'Sveltia CMS',
    contents: 'write',
  });

  // Editorial Workflow opens, labels, merges and closes pull requests. A token with content access
  // alone gets as far as the commit on the workflow branch, then GitHub refuses to open the pull
  // request. Pull request access also covers the label writes, which accept either it or issue
  // access, and the labels are read from the pulls endpoint rather than the issues one.
  // @see https://github.com/sveltia/sveltia-cms/discussions/1000
  // @see https://github.com/sveltia/sveltia-cms/issues/1014
  if (isWorkflowConfigured(cmsConfig.current)) {
    params.set('pull_requests', 'write');
  }

  return `${origin}/settings/personal-access-tokens/new?${params}`;
};

/**
 * Sign in with the GitHub REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup or
 * the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 */
export const signIn = (options) => signInToBackend({ options, getUserProfile });

export { signOut } from '$lib/services/backends/git/shared/auth';
