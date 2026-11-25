import { getTemplateTags } from '$lib/services/common/template/tags';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';

/**
 * @import { UnsupportedOption } from '$lib/types/private';
 */

/**
 * Describe an option or option value removed in Sveltia CMS 5.0 for `checkUnsupportedOptions()`.
 * It’s reported with an error of its own that names the replacement and links to the migration
 * guide, rather than being ignored like an unknown option, because ignoring it would change where
 * or how content is saved without notice.
 * @param {string} prop Option name.
 * @param {string} [value] Removed value of the option, if the option itself is still supported.
 * @returns {UnsupportedOption} Unsupported option, with the message under
 * `config.error.removed_{value or prop}`.
 */
const removed = (prop, value) => ({
  prop,
  value,
  strKey: `removed_${value ?? prop}`,
  extraStrKey: 'migration_link',
});

/**
 * I18n structure removed in Sveltia CMS 5.0 in favor of `multiple_root_folders`.
 */
export const REMOVED_I18N_STRUCTURE = 'multiple_folders_i18n_root';

/**
 * Backend options removed in Sveltia CMS 5.0.
 * @type {UnsupportedOption[]}
 */
export const REMOVED_BACKEND_OPTIONS = [removed('automatic_deployments')];

/**
 * I18n options and values removed in Sveltia CMS 5.0, at the site, collection or file level.
 * @type {UnsupportedOption[]}
 */
export const REMOVED_I18N_OPTIONS = [
  removed('save_all_locales'),
  removed('omit_default_locale_from_filename'),
  removed('structure', REMOVED_I18N_STRUCTURE),
];

/**
 * Collection options removed in Sveltia CMS 5.0.
 * @type {UnsupportedOption[]}
 */
export const REMOVED_COLLECTION_OPTIONS = [removed('slug_length'), removed('yaml_quote')];

/**
 * Where the configuration parser looks for the removed options, as a pattern of the JSON pointer
 * to the object holding them: the backend, any i18n options, or a collection.
 * @type {[RegExp, UnsupportedOption[]][]}
 */
const REMOVED_OPTION_LOCATIONS = [
  [/^\/backend$/, REMOVED_BACKEND_OPTIONS],
  [/\/i18n$/, REMOVED_I18N_OPTIONS],
  [/^\/collections\/\d+$/, REMOVED_COLLECTION_OPTIONS],
];

/**
 * Check whether the given property is an option removed in Sveltia CMS 5.0 found where the
 * configuration parser reports it. Elsewhere, it’s just an unknown option.
 * @param {string} name Property name.
 * @param {string} instancePath JSON pointer to the object holding the property, such as
 * `/collections/0`.
 * @returns {boolean} Result.
 */
export const isReportedRemovedOption = (name, instancePath) =>
  REMOVED_OPTION_LOCATIONS.some(
    ([pattern, options]) =>
      pattern.test(instancePath) &&
      // An option whose value was removed is still in the schema
      options.some(({ prop, value }) => prop === name && value === undefined),
  );

/**
 * Check whether the given template uses the `{{fields._slug}}` tag, with or without the `fields.`
 * prefix and transformations such as `localize`, which showed the slug editor before Sveltia CMS
 * 1.0.
 * @param {any} template Template.
 * @returns {boolean} Result.
 */
export const hasRemovedSlugEditorTag = (template) =>
  typeof template === 'string' &&
  getTemplateTags(template).some(({ name }) => stripFieldTagPrefix(name) === '_slug');
