/**
 * Mapping of deprecation warnings that have been issued once. This prevents flooding the console
 * with repeated warnings.
 * @type {Record<string, boolean>}
 * @internal
 */
export const warnedOnceMap = {
  slug_length: false,
  yaml_quote: false,
  uuid_read_only: false,
  save_all_locales: false,
  automatic_deployments: false,
};

/**
 * Deprecation warning messages.
 * @type {Record<string, string>}
 * @internal
 */
export const warningMessages = {
  slug_length:
    'The `slug_length` collection option is deprecated and will be removed in Sveltia CMS 1.0. ' +
    'Use the global `slug.maxlength` option instead. ',
  yaml_quote:
    'The `yaml_quote` collection option is deprecated and will be removed in Sveltia CMS 1.0. ' +
    'Use the global `output.yaml.quote` option instead. `yaml_quote: true` is equivalent to ' +
    '`quote: double`. https://github.com/sveltia/sveltia-cms#controlling-data-output',
  uuid_read_only:
    'The `read_only` option for the UUID field type is deprecated and will be removed in Sveltia ' +
    'CMS 1.0. Use the `readonly` option instead.',
  save_all_locales:
    'The `save_all_locales` i18n option is deprecated and will be removed in Sveltia CMS 1.0. ' +
    'Use the `initial_locales` option instead. `save_all_locales: false` is equivalent to ' +
    '`initial_locales: all`. ' +
    'https://github.com/sveltia/sveltia-cms#disabling-non-default-locale-content',
  automatic_deployments:
    'The `automatic_deployments` backend option is deprecated and will be removed in Sveltia CMS ' +
    '1.0. Use the `skip_ci` option instead. `automatic_deployments: false` is equivalent to ' +
    '`skip_ci: true`, and `automatic_deployments: true` is equivalent to `skip_ci: false`. ' +
    'https://github.com/sveltia/sveltia-cms#disabling-automatic-deployments',
};

/**
 * Issue a deprecation warning if it hasn’t been issued yet.
 * @param {string} key Key of the warning to issue.
 * @param {string} [message] Custom message to display instead of the default one.
 */
export const warnDeprecation = (key, message) => {
  // Skip during tests
  if (import.meta.env.VITEST) {
    return;
  }

  if (!warnedOnceMap[key]) {
    // eslint-disable-next-line no-console
    console.warn(message ?? warningMessages[key]);
    warnedOnceMap[key] = true;
  }
};
