import { getUserProfile } from '$lib/services/backends/git/gitea/user';
import { apiConfig } from '$lib/services/backends/git/shared/api';
import { getTokens } from '$lib/services/backends/git/shared/auth';

/**
 * @import { SignInOptions, User } from '$lib/types/private';
 */

/**
 * Get the URL of the page for creating a new Personal Access Token (PAT) on Gitea/Forgejo.
 * @param {string} repoURL Repository URL, e.g. `https://gitea.com/owner/repo`.
 * @returns {string} URL to create a new PAT.
 */
export const getPatURL = (repoURL) => {
  const { origin } = new URL(repoURL);

  return `${origin}/user/settings/applications`;
};

/**
 * Sign in with the Gitea/Forgejo REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup or
 * the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 */
export const signIn = async (options) => {
  const { token, refreshToken } = (await getTokens({ options, apiConfig })) ?? {};

  if (!token) {
    return undefined;
  }

  return getUserProfile({ token, refreshToken });
};

/**
 * Sign out from the backend. Nothing to do here.
 * @returns {Promise<void>}
 */
export const signOut = async () => undefined;
