/* eslint-disable camelcase */

import { isObject } from '@sveltia/utils/object';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { gitBackendServices, validBackendNames } from '$lib/services/backends';
import { warnDeprecation } from '$lib/services/config/deprecations';

/**
 * @import { GitBackend, SiteConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Parse and validate the backend configuration from the site config.
 * @param {SiteConfig} siteConfig Raw site configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the backend config.
 */
export const parseBackendConfig = (siteConfig, collectors) => {
  const { backend } = siteConfig;
  const { errors, warnings } = collectors;

  if (!isObject(backend)) {
    errors.add(get(_)('config.error.missing_backend'));

    return;
  }

  const { name } = backend;

  if (!name) {
    errors.add(get(_)('config.error.missing_backend_name'));

    return;
  }

  if (!validBackendNames.includes(name)) {
    errors.add(get(_)('config.error.unsupported_backend', { values: { name } }));

    return;
  }

  if (Object.keys(gitBackendServices).includes(name)) {
    const {
      repo,
      automatic_deployments: autoDeploy,
      // @ts-ignore GitHub/GitLab only
      auth_type: authType,
      // @ts-ignore GitLab/Gitea only
      app_id: appId,
      // @ts-ignore GitHub only
      open_authoring,
    } = /** @type {GitBackend} */ (backend);

    if (repo === undefined) {
      errors.add(get(_)('config.error.missing_repository'));
    }

    if (typeof repo !== 'string' || !/(.+)\/([^/]+)$/.test(repo)) {
      errors.add(get(_)('config.error.invalid_repository'));
    }

    if (authType === 'implicit') {
      errors.add(get(_)('config.error.oauth_implicit_flow'));
    }

    if ((name === 'gitea' || (name === 'gitlab' && authType === 'pkce')) && !appId) {
      errors.add(get(_)('config.error.oauth_no_app_id'));
    }

    // @todo Remove the option prior to the 1.0 release.
    if (autoDeploy !== undefined) {
      warnDeprecation('automatic_deployments');
    }

    if (name === 'github' && open_authoring) {
      warnings.add(get(_)('config.warning.open_authoring_unsupported'));
    }
  }
};
