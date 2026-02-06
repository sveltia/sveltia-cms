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
  multiple_folders_i18n_root: false,
  omit_default_locale_from_filename: false,
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
    '`quote: double`. https://sveltiacms.app/en/docs/data-output#controlling-data-output',
  uuid_read_only:
    'The `read_only` option for the UUID field type is deprecated and will be removed in Sveltia ' +
    'CMS 1.0. Use the `readonly` option instead.',
  save_all_locales:
    'The `save_all_locales` i18n option is deprecated and will be removed in Sveltia CMS 1.0. ' +
    'Use the `initial_locales` option instead. `save_all_locales: false` is equivalent to ' +
    '`initial_locales: all`. ' +
    'https://sveltiacms.app/en/docs/i18n#disabling-non-default-locale-content',
  automatic_deployments:
    'The `automatic_deployments` backend option is deprecated and will be removed in Sveltia CMS ' +
    '1.0. Use the `skip_ci` option instead. `automatic_deployments: false` is equivalent to ' +
    '`skip_ci: true`, and `automatic_deployments: true` is equivalent to `skip_ci: false`. ' +
    'https://sveltiacms.app/en/docs/deployments#disabling-automatic-deployments',
  multiple_folders_i18n_root:
    'The `multiple_folders_i18n_root` i18n structure is deprecated and will be removed in ' +
    'Sveltia CMS 1.0. Use the `multiple_root_folders` structure instead. ' +
    'https://sveltiacms.app/en/docs/i18n#multiple-root-folders',
  omit_default_locale_from_filename:
    'The `omit_default_locale_from_filename` i18n option is deprecated and will be removed in ' +
    'Sveltia CMS 1.0. Use the `omit_default_locale_from_file_path` option instead. ' +
    'https://sveltiacms.app/en/docs/i18n#multiple-files-with-default-locale-omission',
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
