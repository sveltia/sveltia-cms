import { BACKEND_NAME } from '$lib/services/backends/git/gitlab/constants';
import { fetchUserProfile } from '$lib/services/backends/git/shared/user';

/**
 * @import { AuthTokens, User } from '$lib/types/private';
 */

/**
 * Retrieve the authenticated user’s profile information from GitLab REST API.
 * @param {AuthTokens} tokens Authentication tokens.
 * @returns {Promise<User>} User information.
 * @see https://docs.gitlab.com/api/users.html#list-current-user
 */
export const getUserProfile = (tokens) =>
  fetchUserProfile(tokens, BACKEND_NAME, {
    name: 'name',
    login: 'username',
    profileURL: 'web_url',
  });
