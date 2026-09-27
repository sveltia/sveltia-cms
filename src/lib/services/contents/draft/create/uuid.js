import { getField } from '$lib/services/contents/entry/fields';
import { getInitialValue } from '$lib/services/contents/fields/uuid/helpers';
import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';

/**
 * @import { GetFieldArgs, InternalLocaleCode, LocaleContentMap } from '$lib/types/private';
 * @import { UuidField } from '$lib/types/public';
 */

/**
 * Fill in the empty UUID fields of a new entry draft, so that every UUID is in place as soon as the
 * draft is created, whether or not the field is ever rendered in the editor. The default locale and
 * any locale where the field is translatable get a UUID of their own, while a field with the
 * `duplicate` i18n strategy takes the default locale’s value, as the default values of each locale
 * are created separately. A value that is already there, e.g. a dynamic default value, is kept.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.contentMap Flattened content of each locale, modified in place.
 * @param {InternalLocaleCode} args.defaultLocale Default locale.
 * @param {Omit<GetFieldArgs, 'keyPath' | 'valueMap'>} args.getFieldArgs Arguments for
 * {@link getField}, except the key path and value map.
 */
export const fillUuidValues = ({ contentMap, defaultLocale, getFieldArgs }) => {
  const defaultContent = contentMap[defaultLocale];

  // Process the default locale first, so the other locales can copy its values
  const locales = Object.keys(contentMap).sort((a, b) =>
    a === defaultLocale ? -1 : b === defaultLocale ? 1 : 0,
  );

  locales.forEach((locale) => {
    const content = contentMap[locale];

    Object.keys(content).forEach((keyPath) => {
      const fieldConfig = getField({ ...getFieldArgs, keyPath, valueMap: content });

      if (fieldConfig?.widget !== 'uuid' || content[keyPath]) {
        return;
      }

      if (locale === defaultLocale || isFieldTranslatable(fieldConfig.i18n)) {
        content[keyPath] = getInitialValue(/** @type {UuidField} */ (fieldConfig));
      } else if (fieldConfig.i18n === 'duplicate' && defaultContent?.[keyPath]) {
        content[keyPath] = defaultContent[keyPath];
      }
    });
  });
};
