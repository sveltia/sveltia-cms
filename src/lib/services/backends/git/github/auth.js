import { getUserProfile } from '$lib/services/backends/git/github/user';
import { apiConfig } from '$lib/services/backends/git/shared/api';
import { getTokens } from '$lib/services/backends/git/shared/auth';

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
export const getPatURL = (repoURL) => {
  const { origin } = new URL(repoURL);

  const params = new URLSearchParams({
    name: 'Sveltia CMS',
    contents: 'write',
  });

  return `${origin}/settings/personal-access-tokens/new?${params}`;
};

/**
 * Sign in with GitHub REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 * @todo Add `refreshToken` support.
 */
export const signIn = async (options) => {
  const { token, refreshToken } = (await getTokens({ options, apiConfig })) ?? {};

  if (!token) {
    return undefined;
  }

  return getUserProfile({ token, refreshToken });
};

/**
 * Sign out from GitHub. Nothing to do here.
 * @returns {Promise<void>}
 */
export const signOut = async () => undefined;
