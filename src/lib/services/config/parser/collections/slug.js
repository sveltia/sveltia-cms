import { isObject } from '@sveltia/utils/object';

import { warnDeprecation } from '$lib/services/config/deprecations';
import { addMessage, checkRegex } from '$lib/services/config/parser/utils/validator';
import {
  getConfiguredSlugTemplate,
  hasLegacySlugEditorTag,
} from '$lib/services/contents/collection/slug';
import { I18N_STRUCTURES } from '$lib/services/contents/i18n/config/constants';
import { mergeI18nConfigs } from '$lib/services/contents/i18n/config/merge';
import { hasLocalePlaceholder } from '$lib/services/contents/i18n/placeholder';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { CollectionSlugOptions, EntryCollection } from '$lib/types/public';
 */

/**
 * I18n structures that store every locale in one file, so an entry can’t have a slug of its own in
 * each locale.
 * @type {string[]}
 */
const SINGLE_FILE_STRUCTURES = [
  I18N_STRUCTURES.SINGLE_FILE,
  I18N_STRUCTURES.SINGLE_FILE_DEFAULT_ROOT,
];

/**
 * Check the `slug` option of an entry collection. The shape of the option is checked against the
 * JSON schema; this checks what the schema can’t: the template, the validation pattern, and whether
 * the slug can be localized at all.
 * @param {object} args Arguments.
 * @param {EntryCollection} args.collection Collection config to check.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 * @see https://github.com/sveltia/sveltia-cms/issues/999
 */
export const checkSlugOptions = ({ collection, context, collectors }) => {
  const { cmsConfig } = context;
  const { slug, folder } = collection;
  const template = getConfiguredSlugTemplate(collection);

  // @todo Remove the legacy tags prior to the 1.0 release.
  if (hasLegacySlugEditorTag(template)) {
    warnDeprecation('slug_editor_tag');
  }

  // Validate slug template: should not contain slashes to avoid confusion with `path` option.
  // @see https://github.com/decaporg/decap-cms/issues/513
  if (template?.includes('/')) {
    addMessage({
      strKey: 'invalid_slug_slash',
      values: { slug: template },
      context,
      collectors,
    });
  }

  if (!isObject(slug)) {
    return;
  }

  const { pattern, i18n } = /** @type {CollectionSlugOptions} */ (slug);

  // The `pattern` option is a `[regex, message]` pair; anything else is reported against the JSON
  // schema
  if (Array.isArray(pattern)) {
    checkRegex({ option: 'pattern', pattern: pattern[0], context, collectors });
  }

  if (i18n === true) {
    const i18nConfig = mergeI18nConfigs({ cmsConfig, collection });
    const structure = i18nConfig?.structure ?? I18N_STRUCTURES.SINGLE_FILE;

    // The slug can only be localized when each locale has a file of its own. The `{{locale}}`
    // placeholder in the `folder` option makes a folder for each locale, whatever the configured
    // structure
    if (
      !i18nConfig?.locales?.length ||
      (SINGLE_FILE_STRUCTURES.includes(structure) &&
        !(typeof folder === 'string' && hasLocalePlaceholder(folder)))
    ) {
      addMessage({ type: 'warning', strKey: 'slug_i18n_ineffective', context, collectors });
    }
  }
};
