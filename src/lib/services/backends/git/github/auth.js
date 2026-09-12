import { getUserProfile } from '$lib/services/backends/git/github/user';
import { signInToBackend } from '$lib/services/backends/git/shared/auth';

/**
 * @import { SignInOptions, User } from '$lib/types/private';
 */

/**
 * Get the URL of the page for creating a new Personal Access Token (PAT) on GitHub.
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
