/**
 * @import { ApiEndpointConfig, RepositoryInfo } from '$lib/types/private';
 */

/**
 * @type {RepositoryInfo}
 */
export const REPOSITORY_INFO_PLACEHOLDER = {
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
export const API_CONFIG_INFO_PLACEHOLDER = {
  clientId: '',
  authURL: '',
  tokenURL: '',
  authScheme: 'token',
  origin: '',
  restBaseURL: '',
  graphqlBaseURL: '',
};
