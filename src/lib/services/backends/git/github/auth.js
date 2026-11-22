import { loadAdditions } from '$lib/services/app/additions';
import { getUserProfile } from '$lib/services/backends/git/github/user';
import {
  signInToBackend,
  signOut as signOutFromBackend,
} from '$lib/services/backends/git/shared/auth';
import { cmsConfig } from '$lib/services/config';
import { isWorkflowConfigured } from '$lib/services/workflow/config';

/**
 * @import { SignInOptions, User } from '$lib/types/private';
 */

/**
 * Get the URL of the page for creating a new Personal Access Token (PAT) on GitHub. The permissions
 * the CMS needs are pre-filled, so a user who follows the link gets a token that works.
 * @param {string} instanceURL Base URL of the GitHub instance, e.g. `https://github.com`. GitHub
 * Enterprise Server doesn’t run under a subpath, so only the origin is used.
 * @returns {string} URL to create a new PAT.
 * @see https://github.blog/changelog/2025-08-26-template-urls-for-fine-grained-pats-and-updated-permissions-ui/
 * @see https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
 */
export const getTokenPageURL = (instanceURL) => {
  const { origin } = new URL(instanceURL);

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
 * Sign in with the GitHub REST API, or with Sveltia CMS Additions when it’s enabled, which hands
 * out the GitHub token instead.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup,
 * the sign-in flow cannot be started, or a Sveltia CMS Additions user must change their password.
 * @throws {Error} When there was an authentication error.
 */
export const signIn = async (options) => {
  const additions = await loadAdditions();

  return additions
    ? additions.signInWithAdditions(options)
    : signInToBackend({ options, getUserProfile });
};

/**
 * Sign out. With Sveltia CMS Additions, this ends the session there, revoking its GitHub token.
 * @returns {Promise<void>}
 */
export const signOut = async () => {
  const additions = await loadAdditions();

  return additions ? additions.signOutFromAdditions() : signOutFromBackend();
};
