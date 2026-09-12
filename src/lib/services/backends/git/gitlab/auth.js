import { getUserProfile } from '$lib/services/backends/git/gitlab/user';
import { signInToBackend } from '$lib/services/backends/git/shared/auth';

/**
 * @import { SignInOptions, User } from '$lib/types/private';
 */

/**
 * Get the URL of the page for creating a new Personal Access Token (PAT) on GitLab.
 * @param {string} repoURL Repository URL, e.g. `https://gitlab.com/owner/repo`.
 * @returns {string} URL to create a new PAT.
 * @see https://docs.gitlab.com/user/profile/personal_access_tokens/
 */
export const getTokenPageURL = (repoURL) => {
  const { origin } = new URL(repoURL);

  const params = new URLSearchParams({
    name: 'Sveltia CMS',
    scopes: 'api,read_user',
  });

  return `${origin}/-/user_settings/personal_access_tokens?${params}`;
};

/**
 * Sign in with the GitLab REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup or
 * the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 */
export const signIn = (options) => signInToBackend({ options, getUserProfile });

export { signOut } from '$lib/services/backends/git/shared/auth';
