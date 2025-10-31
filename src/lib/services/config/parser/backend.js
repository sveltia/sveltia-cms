/* eslint-disable camelcase */

import { isObject } from '@sveltia/utils/object';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { gitBackendServices, validBackendNames } from '$lib/services/backends';
import { warnDeprecation } from '$lib/services/config/deprecations';

/**
 * @import { GitBackend, SiteConfig } from '$lib/types/public';
 */

/**
 * Parse and validate the backend configuration from the site config.
 * @param {SiteConfig} config Raw config object.
 * @throws {Error} If there is an error in the backend config.
 */
export const parseBackendConfig = (config) => {
  const { backend } = config;

  if (!isObject(backend)) {
    throw new Error(get(_)('config.error.missing_backend'));
  }

  const {
    name,
    repo,
    // @ts-ignore Gitea backend doesn’t have the property
    auth_type: authType,
    // @ts-ignore GitHub backend doesn’t have the property
    app_id: appId,
    automatic_deployments: autoDeploy,
    // @ts-ignore GitHub only
    open_authoring,
  } = /** @type {GitBackend} */ (backend);

  if (!name) {
    throw new Error(get(_)('config.error.missing_backend_name'));
  }

  if (!validBackendNames.includes(name)) {
    throw new Error(get(_)('config.error.unsupported_backend', { values: { name } }));
  }

  if (Object.keys(gitBackendServices).includes(name)) {
    if (repo === undefined) {
      throw new Error(get(_)('config.error.missing_repository'));
    }

    if (typeof repo !== 'string' || !/(.+)\/([^/]+)$/.test(repo)) {
      throw new Error(get(_)('config.error.invalid_repository'));
    }

    if (authType === 'implicit') {
      throw new Error(get(_)('config.error.oauth_implicit_flow'));
    }

    if ((name === 'gitea' || (name === 'gitlab' && authType === 'pkce')) && !appId) {
      throw new Error(get(_)('config.error.oauth_no_app_id'));
    }

    // @todo Remove the option prior to the 1.0 release.
    if (autoDeploy !== undefined) {
      warnDeprecation('automatic_deployments');
    }
  }

  if (name === 'github' && open_authoring) {
    // eslint-disable-next-line no-console
    console.warn('Open authoring is not yet supported in Sveltia CMS.');
  }
};
