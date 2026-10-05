import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { parseTransformations } from '$lib/services/common/transformations';
import { addMessage } from '$lib/services/config/parser/utils/validator';
import { mergeI18nConfigs } from '$lib/services/contents/i18n/config/merge';

/**
 * @import { FieldParserArgs } from '$lib/types/private';
 * @import { HiddenField } from '$lib/types/public';
 */

/**
 * Check whether the given template uses the `{{locale}}` tag, with or without transformations.
 * @param {string} template Template.
 * @returns {boolean} Result.
 */
const hasLocaleTag = (template) => {
  let found = false;

  replaceTemplateTags(template, (match, placeholder) => {
    if (parseTransformations(placeholder).value === 'locale') {
      found = true;
    }

    return match;
  });

  return found;
};

/**
 * Parse and validate a Hidden field configuration. The `{{locale}}` tag in the `default` option is
 * replaced with the locale of the content, which a collection or file without i18n doesn’t have,
 * so the value would be the key the CMS uses internally for such content instead.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseHiddenFieldConfig = ({ config, context, collectors }) => {
  const { default: defaultValue } = /** @type {HiddenField} */ (config);
  const { cmsConfig, collection, collectionFile: file } = context;

  // The locale of an editor component’s content isn’t known here
  if (typeof defaultValue !== 'string' || !collection || !hasLocaleTag(defaultValue)) {
    return;
  }

  if (!mergeI18nConfigs({ cmsConfig, collection, file })?.locales?.length) {
    addMessage({ strKey: 'hidden_field_locale_without_i18n', context, collectors });
  }
};
