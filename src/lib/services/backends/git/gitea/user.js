import { BACKEND_NAME } from '$lib/services/backends/git/gitea/constants';
import { fetchUserProfile } from '$lib/services/backends/git/shared/user';

/**
 * @import { AuthTokens, User } from '$lib/types/private';
 */

/**
 * Retrieve the authenticated user’s profile information from Gitea/Forgejo REST API.
 * @param {AuthTokens} tokens Authentication tokens.
 * @returns {Promise<User>} User information.
 * @see https://docs.gitea.com/api/next/#tag/user/operation/userGetCurrent
 */
export const getUserProfile = (tokens) =>
  fetchUserProfile(tokens, BACKEND_NAME, {
    name: 'full_name',
    login: 'login',
    profileURL: 'html_url',
  });
