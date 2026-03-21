import { BACKEND_NAME } from '$lib/services/backends/git/github/constants';
import { fetchUserProfile } from '$lib/services/backends/git/shared/user';

/**
 * @import { AuthTokens, User } from '$lib/types/private';
 */

/**
 * Retrieve the authenticated user’s profile information from GitHub REST API.
 * @param {AuthTokens} tokens Authentication tokens.
 * @returns {Promise<User>} User information.
 * @see https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 */
export const getUserProfile = (tokens) =>
  fetchUserProfile(tokens, BACKEND_NAME, {
    name: 'name',
    login: 'login',
    profileURL: 'html_url',
  });
