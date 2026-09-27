import { isDuplicatedField } from '$lib/services/contents/draft/create/proxy.svelte';
import { getField } from '$lib/services/contents/entry/fields';
import { getInitialValue } from '$lib/services/contents/fields/uuid/helpers';
import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';

/**
 * @import {
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalLocaleCode,
 * LocaleContentMap,
 * } from '$lib/types/private';
 * @import { UuidField } from '$lib/types/public';
 */

/**
 * Regular expression to match the key path of the innermost list item a field belongs to, e.g.
 * `blocks.0` for `blocks.0.meta.id`.
 */
const LIST_ITEM_KEY_PATH_REGEX = /^.*\.\d+(?=\.)/;

/**
 * Fill in the empty UUID fields of a new entry draft, so that every UUID is in place as soon as the
 * draft is created, whether or not the field is ever rendered in the editor. The default locale and
 * any locale where the field is translatable get a UUID of their own, while a duplicated field,
 * including one nested in a List or Object field with the `duplicate` i18n strategy, takes the
 * default locale’s value, as the default values of each locale are created separately. A value
 * that is already there, e.g. a dynamic default value, is kept.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.contentMap Flattened content of each locale, modified in place.
 * @param {InternalLocaleCode} args.defaultLocale Default locale.
 * @param {Omit<GetFieldArgs, 'keyPath' | 'valueMap'>} args.getFieldArgs Arguments for
 * {@link getField}, except the key path and value map.
 */
export const fillUuidValues = ({ contentMap, defaultLocale, getFieldArgs }) => {
  const defaultContent = contentMap[defaultLocale];

  /**
   * Get the configuration of the UUID field at the given key path.
   * @param {FlattenedEntryContent} content Content the key path belongs to.
   * @param {string} keyPath Key path.
   * @returns {UuidField | undefined} Field configuration, or `undefined` if it’s not a UUID field.
   */
  const getUuidField = (content, keyPath) => {
    const fieldConfig = getField({ ...getFieldArgs, keyPath, valueMap: content });

    return fieldConfig?.widget === 'uuid' ? /** @type {UuidField} */ (fieldConfig) : undefined;
  };

  if (defaultContent) {
    Object.keys(defaultContent).forEach((keyPath) => {
      const fieldConfig = getUuidField(defaultContent, keyPath);

      if (fieldConfig && !defaultContent[keyPath]) {
        defaultContent[keyPath] = getInitialValue(fieldConfig);
      }
    });
  }

  Object.entries(contentMap).forEach(([locale, content]) => {
    if (locale === defaultLocale) {
      return;
    }

    Object.keys(content).forEach((keyPath) => {
      const fieldConfig = getUuidField(content, keyPath);

      if (fieldConfig && !content[keyPath] && isFieldTranslatable(fieldConfig.i18n)) {
        content[keyPath] = getInitialValue(fieldConfig);
      }
    });

    if (!defaultContent) {
      return;
    }

    // A duplicated field takes the default locale’s value. A field nested in a duplicated List or
    // Object field isn’t among the locale’s default values unless it has an `i18n` option of its
    // own, so copy it as long as the list item it belongs to, if any, is there as well
    Object.entries(defaultContent).forEach(([keyPath, value]) => {
      const fieldConfig = getUuidField(defaultContent, keyPath);
      const listItemKeyPath = keyPath.match(LIST_ITEM_KEY_PATH_REGEX)?.[0];

      if (
        fieldConfig &&
        !content[keyPath] &&
        isDuplicatedField({
          fieldConfig,
          getFieldArgs: { ...getFieldArgs, keyPath, valueMap: defaultContent },
        }) &&
        (!listItemKeyPath ||
          Object.keys(content).some((key) => key.startsWith(`${listItemKeyPath}.`)))
      ) {
        content[keyPath] = value;
      }
    });
  });
};
