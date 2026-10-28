import { getDraftFieldArgs, getField } from '$lib/services/contents/entry/fields';
import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';
import { isFieldLocalized } from '$lib/services/contents/i18n/fields';
import { getOrCreate } from '$lib/services/utils/cache';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Values of the fields that aren’t localized, which are only stored in the default locale, as
 * given by {@link getDraftSharedValues}.
 * @typedef {object} SharedValues
 * @property {FlattenedEntryContent} values Content of the default locale.
 * @property {(keyPath: string) => boolean} isShared Whether the field at the given key path isn’t
 * localized, so its value is to be read from {@link SharedValues.values}.
 */

/**
 * Get the `i18n` option that applies to the given field: its own, or, if the field has none, that
 * of the nearest ancestor that has one, such as the List or Object field it belongs to.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the key
 * path of the field.
 * @returns {Field['i18n']} Option, or `undefined` if neither the field nor its ancestors have one.
 */
export const getInheritedI18nOption = ({ fieldConfig, getFieldArgs }) => {
  if (fieldConfig.i18n !== undefined) {
    return fieldConfig.i18n;
  }

  const segments = getFieldArgs.keyPath.split('.');

  // Look at the ancestors from the nearest one, skipping the list item indexes, which aren’t fields
  // of their own, e.g. `items` for `items.0.name`
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    if (!isNumeric(segments[index])) {
      const { i18n } =
        getField({ ...getFieldArgs, keyPath: segments.slice(0, index + 1).join('.') }) ?? {};

      if (i18n !== undefined) {
        return i18n;
      }
    }
  }

  return undefined;
};

/**
 * Check whether the field at the given key path belongs in a locale’s content. Every field does in
 * the default locale, but in another locale, only one that is localized along with all of its
 * ancestors, as the others are left out of that locale’s content when it’s saved.
 * @param {object} args Arguments.
 * @param {Omit<GetFieldArgs, 'keyPath'>} args.getFieldArgs Arguments for the `getField` function,
 * without the key path.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {InternalLocaleCode} args.defaultLocale Default locale.
 * @param {string} args.keyPath Concrete key path of the field.
 * @returns {boolean} Result.
 */
export const isFieldInLocale = ({ getFieldArgs, locale, defaultLocale, keyPath }) => {
  if (locale === defaultLocale) {
    return true;
  }

  const segments = keyPath.split('.');

  // Skip the list item indexes, which aren’t fields of their own, e.g. `items.0` in `items.0.kv`
  return segments.every((segment, index) => {
    if (index < segments.length - 1 && isNumeric(segment)) {
      return true;
    }

    const args = { ...getFieldArgs, keyPath: segments.slice(0, index + 1).join('.') };
    const fieldConfig = getField(args);

    return (
      !!fieldConfig && isFieldLocalized(getInheritedI18nOption({ fieldConfig, getFieldArgs: args }))
    );
  });
};

/**
 * Cache of the values {@link addSharedValues} takes from the default locale, keyed by the content
 * of the default locale, then by the collection, file and locale. The content is a saved entry’s or
 * a draft snapshot, which is replaced rather than changed, so a Compute field updated on every
 * keystroke doesn’t look up every field of the default locale each time.
 * @type {WeakMap<FlattenedEntryContent, Map<string, FlattenedEntryContent>>}
 */
const sharedValueCache = new WeakMap();

/**
 * Add the values of the fields that aren’t localized, which are only stored in the default locale,
 * to a locale’s content, so that anything reading the content of a locale, like a Compute field or
 * a `preview_path` template, finds them there as well.
 * @param {object} args Arguments.
 * @param {Omit<GetFieldArgs, 'keyPath' | 'valueMap'>} args.getFieldArgs Arguments for the
 * `getField` function, without the key path and the value map.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {InternalLocaleCode} args.defaultLocale Default locale.
 * @param {FlattenedEntryContent} args.content Content of the locale.
 * @param {FlattenedEntryContent | undefined} args.defaultContent Content of the default locale. It
 * mustn’t be changed in place, as what’s taken from it is cached: pass a draft’s snapshot rather
 * than its live values.
 * @returns {FlattenedEntryContent} Content of the locale with the shared values, or the given
 * content as is for the default locale.
 */
export const addSharedValues = ({
  getFieldArgs,
  locale,
  defaultLocale,
  content,
  defaultContent,
}) => {
  if (locale === defaultLocale || !defaultContent) {
    return content;
  }

  const { collectionName, fileName, isIndexFile } = getFieldArgs;
  const cacheKey = JSON.stringify([collectionName, fileName, isIndexFile, locale, defaultLocale]);

  const sharedValues = getOrCreate(
    getOrCreate(sharedValueCache, defaultContent, () => new Map()),
    cacheKey,
    () => {
      const args = { ...getFieldArgs, valueMap: defaultContent };

      return Object.fromEntries(
        Object.entries(defaultContent).filter(
          ([keyPath]) => !isFieldInLocale({ getFieldArgs: args, locale, defaultLocale, keyPath }),
        ),
      );
    },
  );

  return { ...sharedValues, ...content };
};

/**
 * Get the values of an entry draft’s fields that aren’t localized, for reading them while another
 * locale than the default is edited. Unlike {@link addSharedValues}, no value is read until it’s
 * asked for, so a reactive caller only depends on the values it actually uses.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @param {InternalLocaleCode} locale Locale being edited.
 * @returns {SharedValues | undefined} Shared values, or `undefined` for the default locale.
 */
export const getDraftSharedValues = (draft, locale) => {
  const { defaultLocale } = getDraftI18nConfig(draft);
  const values = draft?.currentValues[defaultLocale];

  if (!draft || !values || locale === defaultLocale) {
    return undefined;
  }

  const getFieldArgs = getDraftFieldArgs(draft, { valueMap: values });

  return {
    values,
    /**
     * Check whether the field at the given key path isn’t localized.
     * @param {string} keyPath Key path.
     * @returns {boolean} Result.
     */
    isShared: (keyPath) => !isFieldInLocale({ getFieldArgs, locale, defaultLocale, keyPath }),
  };
};
