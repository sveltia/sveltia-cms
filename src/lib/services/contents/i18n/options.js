import { locale as appLocale } from '@sveltia/i18n';
import { isObject } from '@sveltia/utils/object';

import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Option of a field or a variable type that can have localized values, given as a map keyed by
 * locale in an option of the same name with the `_localized` suffix, e.g. `label_localized`.
 * @typedef {'label' | 'hint' | 'label_singular' | 'default'} LocalizableOption
 */

/**
 * Configuration that can hold localized options: a field or a variable type of a List/Object field.
 * @typedef {Record<string, any>} LocalizableConfig
 */

/**
 * Cache of {@link getLanguageScript} results, keyed by locale code. The codes come from the
 * configuration and the UI locale, so there are only a few of them, while a label is looked up on
 * every render, e.g. in each cell of the bulk edit table.
 * @type {Map<string, string>}
 */
const languageScriptCache = new Map();

/**
 * Get the language and script of the given locale code, e.g. `zh-Hant` for `zh-TW`, so locales
 * written in different scripts don’t match.
 * @param {string} locale Locale code.
 * @returns {string} Language and script, or the code in lowercase if it’s not a valid locale.
 */
const getLanguageScript = (locale) =>
  getOrCreate(languageScriptCache, locale, () => {
    try {
      const { language, script } = new Intl.Locale(locale).maximize();

      return `${language}-${script}`;
    } catch {
      return locale.toLowerCase();
    }
  });

/**
 * Find the key of a localized value map that matches the given application UI locale. The UI locale
 * comes with a region, e.g. `en-CA`, while the map is keyed with the content locales of the site,
 * which may not, so a key for the same language and script matches as well, the bare language
 * first. A Traditional Chinese UI therefore never gets a Simplified Chinese value.
 * @param {Record<string, any>} map Localized value map.
 * @param {string} uiLocale Application UI locale.
 * @returns {string | undefined} Matching key.
 */
const findUiLocaleKey = (map, uiLocale) => {
  if (Object.hasOwn(map, uiLocale)) {
    return uiLocale;
  }

  const languageScript = getLanguageScript(uiLocale);
  const keys = Object.keys(map).filter((key) => getLanguageScript(key) === languageScript);

  return keys.find((key) => !key.includes('-')) ?? keys[0];
};

/**
 * Get the localized value map of the given option, if it’s defined.
 * @param {LocalizableConfig} config Field or variable type configuration.
 * @param {LocalizableOption} option Option name.
 * @returns {Record<string, any> | undefined} Localized value map.
 */
const getLocalizedValueMap = (config, option) => {
  const map = config[`${option}_localized`];

  return isObject(map) ? map : undefined;
};

/**
 * Get the value of a UI text option, such as `label` or `hint`, for the given content locale. The
 * localized value for the locale, given with the `_localized` counterpart of the option, comes
 * first; where the locale isn’t known (`_default` or `undefined`, as with a collection without
 * i18n, or outside of the entry editor) or has no localized value, the application UI locale is
 * matched instead. The option itself is the fallback.
 * @param {object} args Arguments.
 * @param {LocalizableConfig | undefined} args.config Field or variable type configuration. It can
 * be missing, e.g. for a key path that names no field, in which case there is no value.
 * @param {Exclude<LocalizableOption, 'default'>} args.option Option name.
 * @param {InternalLocaleCode} [args.locale] Content locale, e.g. the locale of the editor pane.
 * @returns {string | undefined} Option value.
 */
export const getLocalizedOption = ({ config, option, locale }) => {
  if (!config) {
    return undefined;
  }

  const map = getLocalizedValueMap(config, option);

  if (map) {
    if (locale && locale !== '_default' && Object.hasOwn(map, locale)) {
      return map[locale];
    }

    const uiLocaleKey = appLocale.current ? findUiLocaleKey(map, appLocale.current) : undefined;

    if (uiLocaleKey !== undefined) {
      return map[uiLocaleKey];
    }
  }

  return config[option];
};

/**
 * Get the label of a field or a variable type for the given content locale, falling back to its
 * name.
 * @param {object} args Arguments.
 * @param {LocalizableConfig} args.config Field or variable type configuration.
 * @param {InternalLocaleCode} [args.locale] Content locale. See {@link getLocalizedOption}.
 * @returns {string} Label.
 */
export const getFieldLabel = ({ config, locale }) =>
  getLocalizedOption({ config, option: 'label', locale }) || config.name || '';

/**
 * Apply the localized default value of a field for the given content locale. Unlike the UI text
 * options, a default value is content, so only the content locale is matched. A duplicated field
 * takes the default locale’s value, as it’s copied from there to the other locales.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {InternalLocaleCode} args.locale Content locale.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry draft.
 * @returns {Field} Field configuration with the `default` option replaced by the localized value
 * and the `default_localized` option removed, or the given configuration as is if it has no
 * localized value for the locale.
 */
export const localizeDefaultValue = ({ fieldConfig, locale, defaultLocale }) => {
  const map = getLocalizedValueMap(fieldConfig, 'default');

  if (!map) {
    return fieldConfig;
  }

  const { default_localized: _localized, ...rest } = /** @type {Record<string, any>} */ (
    fieldConfig
  );

  const targetLocale = fieldConfig.i18n === 'duplicate' ? defaultLocale : locale;

  return /** @type {Field} */ (
    Object.hasOwn(map, targetLocale) ? { ...rest, default: map[targetLocale] } : rest
  );
};
