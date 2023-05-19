import { flatten } from 'flat';
import { escapeRegExp } from '$lib/services/utils/strings';

/**
 * Get entry values that matches the given field name.
 * @param {Entry} refEntry Referenced entry.
 * @param {FlattenedEntryContent} flattenContent Flatten `refEntry.locales[locale].content`.
 * @param {string} fieldName Field name, e.g. `userId`, `{{slug}}`, `name.first` (nested),
 * `cities.*.id` (with wildcard), `{{twitterHandle}} - {{followerCount}}` (template).
 * @returns {any[]} Entry values. Even if there is only one value, it will be returned in an array.
 */
const getEntryValues = (refEntry, flattenContent, fieldName) => {
  if (fieldName === '{{slug}}') {
    return [refEntry.slug];
  }

  if (fieldName.includes('*')) {
    const regex = new RegExp(`^${escapeRegExp(fieldName).replaceAll('\\*', '[^.]')}$`);

    return Object.entries(flattenContent)
      .filter(([keyPath]) => !!keyPath.match(regex))
      .map(([, value]) => value);
  }

  const value =
    flattenContent[fieldName] ||
    fieldName.replaceAll(/{{(.+?)}}/g, (_match, p1) => flattenContent[p1] || '') ||
    undefined;

  return value ? [value] : [];
};

/**
 * Get options for a Relation field.
 * @param {LocaleCode} locale Current locale.
 * @param {RelationField} fieldConfig Field configuration.
 * @param {Entry[]} refEntries Referenced entries.
 * @returns {{ label: string, value: any }[]} Options.
 */
export const getOptions = (locale, fieldConfig, refEntries) => {
  const { value_field: valueField, display_fields: displayFields } = fieldConfig;

  return refEntries
    .map((refEntry) => {
      const { content } = refEntry.locales[locale] || {};

      if (!content) {
        return undefined;
      }

      const flattenContent = flatten(content);

      /** @type {string[]} */
      const labels = (displayFields || [valueField]).reduce((current, displayField) => {
        const _labels = getEntryValues(refEntry, flattenContent, displayField).map((_label) =>
          String(_label),
        );

        if (!current.length) {
          return _labels;
        }

        const arr = [];

        current.forEach((label) => {
          _labels.forEach((_label) => {
            arr.push([label, _label].join(' '));
          });
        });

        return arr;
      }, []);

      /** @type {any[]} */
      const values = getEntryValues(refEntry, flattenContent, valueField);

      return labels.map((label, index) => ({
        label,
        value: values[index] || values[0],
      }));
    })
    .flat(1)
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
};
