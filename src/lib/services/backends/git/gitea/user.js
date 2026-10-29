import { repository } from '$lib/services/backends/git/gitea/repository';
import { fetchUserProfile } from '$lib/services/backends/git/shared/user';

/**
 * @import { AuthTokens, User } from '$lib/types/private';
 * @import { GitBackendName } from '$lib/types/public';
 */

/**
 * Retrieve the authenticated user’s profile information from Gitea/Forgejo REST API.
 * @param {AuthTokens} tokens Authentication tokens.
 * @returns {Promise<User>} User information.
 * @see https://docs.gitea.com/api/next/#tag/user/operation/userGetCurrent
 */
export const getUserProfile = (tokens) =>
  // The backend is configured as either `gitea` or `forgejo`, and initialized before signing in
  fetchUserProfile(tokens, /** @type {GitBackendName} */ (repository.service), {
    name: 'full_name',
    login: 'login',
    profileURL: 'html_url',
  });
