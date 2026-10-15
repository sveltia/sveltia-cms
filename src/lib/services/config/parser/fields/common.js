import { isObject } from '@sveltia/utils/object';

import { addMessage, checkRegex } from '$lib/services/config/parser/utils/validator';
import { mergeI18nConfigs } from '$lib/services/contents/i18n/config/merge';

/**
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Pairs of options that bound a value from both sides, in the order they have to be in. Each pair
 * belongs to some field types only, but a pair that isn’t in a field’s configuration is simply not
 * checked, so it’s not worth spelling out which.
 * @type {[string, string][]}
 */
const RANGE_OPTIONS = [
  ['min', 'max'],
  ['minlength', 'maxlength'],
];

/**
 * Check the `default_localized` option. Its values are matched against the content locales only, so
 * a value for a locale the collection doesn’t have is never used, and none of them is without i18n.
 * The locales of an editor component’s content aren’t known here, so its fields aren’t checked.
 * @param {FieldParserArgs} args Arguments.
 */
const checkLocalizedDefault = ({ config, context, collectors }) => {
  const { default_localized: localizedDefault } = /** @type {Record<string, any>} */ (config);
  const { cmsConfig, collection, collectionFile: file } = context;

  if (!isObject(localizedDefault) || !collection) {
    return;
  }

  const locales = mergeI18nConfigs({ cmsConfig, collection, file })?.locales ?? [];

  if (!locales.length) {
    addMessage({ type: 'warning', strKey: 'default_localized_without_i18n', context, collectors });

    return;
  }

  Object.keys(localizedDefault)
    .filter((locale) => !locales.includes(locale))
    .forEach((locale) => {
      addMessage({
        type: 'warning',
        strKey: 'default_localized_unknown_locale',
        values: { locale },
        context,
        collectors,
      });
    });
};

/**
 * Check the options that any field type can have. A `pattern` that can’t be compiled makes the
 * field skip its validation, and a range whose lower bound is above its upper bound can’t be
 * satisfied, but neither is reported at runtime, nor is a localized default value that’s unused.
 * @param {FieldParserArgs} args Arguments.
 */
export const checkCommonFieldOptions = ({ config, context, collectors }) => {
  const { pattern } = /** @type {Record<string, any>} */ (config);

  // The `pattern` option is a `[regex, message]` pair; anything else is reported against the JSON
  // schema
  if (Array.isArray(pattern)) {
    checkRegex({ option: 'pattern', pattern: pattern[0], context, collectors });
  }

  RANGE_OPTIONS.forEach(([minOption, maxOption]) => {
    const { [minOption]: min, [maxOption]: max } = /** @type {Record<string, any>} */ (config);

    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      addMessage({
        strKey: 'invalid_range_options',
        values: { min: minOption, max: maxOption },
        context,
        collectors,
      });
    }
  });

  checkLocalizedDefault({ config, context, collectors });
};
