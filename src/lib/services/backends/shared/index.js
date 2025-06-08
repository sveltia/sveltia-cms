/**
 * @import { ApiEndpointConfig, RepositoryInfo } from '$lib/types/private';
 */

/**
 * @type {RepositoryInfo}
 */
export const repositoryInfoPlaceholder = {
  service: '',
  label: '',
  owner: '',
  repo: '',
  branch: '',
  baseURL: '',
  treeBaseURL: '',
  blobBaseURL: '',
  isSelfHosted: false,
  databaseName: '',
};

/**
 * @type {ApiEndpointConfig}
 */
export const apiConfigPlaceholder = {
  clientId: '',
  authURL: '',
  tokenURL: '',
  authScheme: 'token',
  origin: '',
  restBaseURL: '',
  graphqlBaseURL: '',
};
