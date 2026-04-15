import { _ } from '@sveltia/i18n';
import { isObject } from '@sveltia/utils/object';

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
  // Sveltia CMS always uses GraphQL for Git backends, so this option is not applicable.
  { type: 'warning', prop: 'use_graphql', strKey: 'unsupported_ignored_option' },
  // @todo Remove this warning when Sveltia CMS adds support for open authoring.
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
  const { errors, warnings } = collectors;

  if (!isObject(backend)) {
    errors.add(_('config.error.missing_backend'));

    return;
  }

  const { name } = backend;

  if (!name) {
    errors.add(_('config.error.missing_backend_name'));

    return;
  }

  if (!validBackendNames.includes(name)) {
    const _backend = unsupportedBackends[name];
    const type = _backend ? (_backend.deprecated ? 'deprecated' : 'known') : 'custom';
    const label = _backend?.label;
    const message = _(`config.error.unsupported_${type}_backend`, { values: { name: label } });

    errors.add(`${message} ${_('config.error.unsupported_backend_suggestion')}`);

    return;
  }

  if (name in gitBackendServices) {
    const {
      repo,
      automatic_deployments: autoDeploy,
      allow_token_auth: allowTokenAuth = true,
      // @ts-ignore GitHub/GitLab only
      auth_type: authType,
      // @ts-ignore GitLab/Gitea only
      app_id: appId,
    } = /** @type {GitBackend} */ (backend);

    if (repo === undefined) {
      errors.add(_('config.error.missing_repository'));
    }

    if (typeof repo !== 'string' || !/(.+)\/([^/]+)$/.test(repo)) {
      errors.add(_('config.error.invalid_repository'));
    }

    if (authType === 'implicit') {
      errors.add(_('config.error.oauth_implicit_flow'));
    }

    if (name === 'github' && authType === 'pkce') {
      errors.add(_('config.error.github_pkce_unsupported'));
    }

    if (name === 'gitlab' && authType === 'pkce' && !appId) {
      errors.add(_('config.error.oauth_no_app_id'));
    }

    // Gitea requires an app ID for OAuth authentication, but also supports token-based sign-in,
    // which doesn't require one. If no app ID is configured and token auth is allowed (the
    // default), we issue a warning and disable the OAuth Sign In button in the UI — users can still
    // sign in with a token. If token auth is explicitly disabled as well, we issue an error because
    // there is no working sign-in method available.
    // @see https://github.com/sveltia/sveltia-cms/issues/721
    if (name === 'gitea' && !appId) {
      if (allowTokenAuth) {
        warnings.add(_('config.warning.oauth_no_app_id'));
      } else {
        errors.add(_('config.error.oauth_no_app_id'));
      }
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
