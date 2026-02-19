import { isObject } from '@sveltia/utils/object';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { gitBackendServices, unsupportedBackends, validBackendNames } from '$lib/services/backends';
import { warnDeprecation } from '$lib/services/config/deprecations';
import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';

/**
 * @import { CmsConfig, GitBackend } from '$lib/types/public';
 * @import { ConfigParserCollectors, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options for Relation fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  { type: 'warning', prop: 'use_graphql', strKey: 'unsupported_ignored_option' },
  { type: 'warning', prop: 'open_authoring', strKey: 'open_authoring_unsupported' },
];

/**
 * Parse and validate the backend configuration from the site config.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the backend config.
 */
export const parseBackendConfig = (cmsConfig, collectors) => {
  const { backend } = cmsConfig;
  const { errors } = collectors;

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
    const unsupportedBackend = unsupportedBackends[name];

    const message = get(_)(
      `config.error.unsupported_${unsupportedBackend ? 'known' : 'custom'}_backend`,
      { values: { name: unsupportedBackend?.label } },
    );

    errors.add(`${message} ${get(_)('config.error.unsupported_backend_suggestion')}`);

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

    if (name === 'github' && authType === 'pkce') {
      errors.add(get(_)('config.error.github_pkce_unsupported'));
    }

    if ((name === 'gitea' || authType === 'pkce') && !appId) {
      errors.add(get(_)('config.error.oauth_no_app_id'));
    }

    // @todo Remove the option prior to the 1.0 release.
    if (autoDeploy !== undefined) {
      warnDeprecation('automatic_deployments');
    }

    checkUnsupportedOptions({
      UNSUPPORTED_OPTIONS,
      config: backend,
      context: { cmsConfig },
      collectors,
    });
  }
};
