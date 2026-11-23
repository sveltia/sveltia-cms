import { stripSlashes } from '@sveltia/utils/string';

import { apiConfig } from '$lib/services/backends/git/shared/api';
import { initRepositoryInfo } from '$lib/services/backends/git/shared/repository';

/**
 * @import { ApiEndpointConfig, RepositoryInfo } from '$lib/types/private';
 */

/**
 * Initialize a Git backend with the values read from the CMS configuration: fill in the repository
 * info, build the OAuth authorization and token URLs, and set up the API endpoint configuration.
 * Reading the configuration is left to each backend, since the defaults and the way the repository
 * path is parsed vary between services.
 * @param {RepositoryInfo} repository Repository info placeholder to be updated in place.
 * @param {Parameters<typeof initRepositoryInfo>[1] & {
 * authRoot: string, authPath: string, tokenPath: string,
 * api: Omit<ApiEndpointConfig, 'authURL' | 'tokenURL'>
 * }} args Arguments for {@link initRepositoryInfo}, plus the following. `authRoot` and
 * `authPath` are the `base_url` and `auth_endpoint` backend options, which are joined into the
 * authorization URL. `tokenPath` is the path that replaces `/authorize` in the authorization URL to
 * make the token URL, e.g. `/access_token`. `api` is the rest of the API endpoint configuration.
 * @returns {RepositoryInfo} The updated repository info.
 */
export const initGitBackend = (repository, { authRoot, authPath, tokenPath, api, ...args }) => {
  const authURL = `${stripSlashes(authRoot)}/${stripSlashes(authPath)}`;

  initRepositoryInfo(repository, args);

  Object.assign(
    apiConfig,
    /** @type {ApiEndpointConfig} */ ({
      ...api,
      authURL,
      tokenURL: authURL.replace('/authorize', tokenPath),
    }),
  );

  return repository;
};
