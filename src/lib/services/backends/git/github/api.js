import { stripSlashes } from '@sveltia/utils/string';

import { DEFAULT_API_ROOT } from '$lib/services/backends/git/github/constants';

/**
 * Normalize an API base URL for GitHub Enterprise Server: strip any `/api`, `/api/v3` or
 * `/api/graphql` suffix, then append `/api/{suffix}`. The default API root is kept as is because,
 * unlike other backends, the default `api_root` for GitHub does not end with `/api/v3`, which may
 * lead to misconfigured URLs. A GraphQL URL already ending with `/graphql`, e.g. a proxy given as
 * `graphql_api_root`, is kept as is.
 * @param {string} url The base URL to normalize.
 * @param {'v3' | 'graphql'} suffix API endpoint suffix.
 * @returns {string} Normalized API base URL.
 */
const normalizeBaseURL = (url, suffix) => {
  url = stripSlashes(url);

  if (url === DEFAULT_API_ROOT) {
    // The default REST API root is https://api.github.com, and the GraphQL one appends `/graphql`
    return suffix === 'v3' ? url : `${url}/graphql`;
  }

  if (suffix === 'graphql' && url.endsWith('/graphql')) {
    return url;
  }

  return `${url.replace(/\/api(?:\/v3|\/graphql)?$/, '')}/api/${suffix}`;
};

/**
 * Normalize the REST API base URL. Ensures it ends with `/api/v3` for GitHub Enterprise Server.
 * Otherwise, just use the default API root.
 * @param {string} url The base URL to normalize.
 * @returns {string} Normalized REST API base URL.
 * @see https://docs.github.com/en/enterprise-server@3.17/rest/quickstart?tool=javascript
 */
export const normalizeRestBaseURL = (url) => normalizeBaseURL(url, 'v3');

/**
 * Normalize the GraphQL API base URL. Ensures it ends with `/api/graphql` for GitHub Enterprise
 * Server. Otherwise, just use the default API root followed by `/graphql`.
 * @param {string} url The base URL to normalize.
 * @returns {string} Normalized GraphQL API base URL.
 * @see https://docs.github.com/en/enterprise-server@3.17/graphql/guides/forming-calls-with-graphql#the-graphql-endpoint
 */
export const normalizeGraphQLBaseURL = (url) => normalizeBaseURL(url, 'graphql');
