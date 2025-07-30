import { stripSlashes } from '@sveltia/utils/string';

import { DEFAULT_API_ROOT } from '$lib/services/backends/git/github/constants';

/**
 * Normalize the REST API base URL. Ensures it ends with `/api/v3` for GitHub Enterprise Server.
 * Otherwise, just use the default API root. This is required because, unlike other backends, the
 * default `api_root` for GitHub does not end with `/api/v3`, which may lead to misconfigured URLs.
 * @param {string} url The base URL to normalize.
 * @returns {string} Normalized REST API base URL.
 * @see https://docs.github.com/en/enterprise-server@3.17/rest/quickstart?tool=javascript
 */
export const normalizeRestBaseURL = (url) => {
  url = stripSlashes(url);

  if (url === DEFAULT_API_ROOT) {
    // Default API root for GitHub is https://api.github.com
    return url;
  }

  if (url.endsWith('/api/v3')) {
    // Already normalized
    return url;
  }

  if (url.endsWith('/api')) {
    return `${url}/v3`;
  }

  return `${url}/api/v3`;
};

/**
 * Normalize the GraphQL API base URL. Ensures it ends with `/api/graphql` for GitHub Enterprise
 * Server. Otherwise, just use the default API root followed by `/graphql`.
 * @param {string} url The base URL to normalize.
 * @returns {string} Normalized GraphQL API base URL.
 * @see https://docs.github.com/en/enterprise-server@3.17/graphql/guides/forming-calls-with-graphql#the-graphql-endpoint
 */
export const normalizeGraphQLBaseURL = (url) => {
  url = stripSlashes(url);

  if (url === DEFAULT_API_ROOT) {
    // Default GraphQL API root for GitHub is https://api.github.com/graphql
    return `${url}/graphql`;
  }

  if (url.endsWith('/graphql')) {
    // Already normalized
    return url;
  }

  if (url.endsWith('/api/v3')) {
    // Replace the REST API v3 endpoint with the GraphQL endpoint
    return url.replace('/api/v3', '/graphql');
  }

  if (url.endsWith('/api')) {
    return `${url}/graphql`;
  }

  return `${url}/api/graphql`;
};
