import { flatten, unflatten } from 'flat';
import { getEntriesByCollection, getFieldByKeyPath } from '$lib/services/contents';
import { escapeRegExp } from '$lib/services/utils/strings';

/**
 * Enclose the given field name in brackets if it doesn’t contain any brackets.
 * @param {string} fieldName Field name e.g. `{{name.first}}` or `name.first`.
 * @returns {string} Bracketed field name, e.g. `{{name.first}}`.
 */
const normalizeFieldName = (fieldName) =>
  fieldName.match(/{{.+?}}/) ? fieldName : `{{${fieldName}}}`;

/**
 * Get options for a Relation field.
 * @param {LocaleCode} locale Current locale.
 * @param {RelationField} fieldConfig Field configuration.
 * @param {Entry[]} refEntries Referenced entries.
 * @returns {{ label: string, value: any }[]} Options.
 */
export const getOptions = (locale, fieldConfig, refEntries) => {
  /**
   * @example 'userId'
   * @example 'name.first'
   * @example 'cities.*.id'
   * @example '{{cities.*.id}}'
   * @example '{{slug}}'
   * @example '{{fields.slug}}'
   */
  const valueField = fieldConfig.value_field;
  /**
   * @example ['userId']
   * @example ['name.first'] (nested)
   * @example ['cities.*.id', 'cities.*.name'] (with wildcard, multiple)
   * @example ['{{twitterHandle}} - {{followerCount}}'] (template)
   */
  const displayFields = fieldConfig.display_fields;
  /**
   * Canonical, templatized value field.
   * @example '{{name.first}}'
   * @example '{{route}}#{{sections.*.name}}'
   */
  const _valueField = normalizeFieldName(valueField);
  /**
   * Canonical, templatized display field.
   * @example '{{twitterHandle}} {{followerCount}}'
   * @example '{{sections.*.name}}'
   * @example '{{route}}: {{sections.*.name}} ({{sections.*.id}})'
   */
  const _displayField = (displayFields || [valueField]).map(normalizeFieldName).join(' ');

  return refEntries
    .map((refEntry) => {
      const { content } = refEntry.locales[locale] || {};

      if (!content) {
        return undefined;
      }

      /**
       * @type {FlattenedEntryContent}
       */
      const flattenContent = flatten(content);

      /**
       * Map of replacing values. For a list widget, the key is a _partial_ key path like `cities.*`
       * instead of `cities.*.id` or `cities.*.name`, and the value is a key-value map, so that
       * multiple references can be replaced at once. Otherwise, the key is a complete key path
       * except for `slug`, and the value is the actual value.
       * @type {{ [key: string]: string | number | object[] }}
       */
      const replacers = Object.fromEntries(
        [
          ...new Set(
            [
              ...[..._displayField.matchAll(/{{(.+?)}}/g)].map((m) => m[1]),
              ...[..._valueField.matchAll(/{{(.+?)}}/g)].map((m) => m[1]),
            ].map((fieldName) =>
              fieldName.includes('.')
                ? fieldName.replace(/^([^.]+)+\.\*\.[^.]+$/, '$1.*')
                : fieldName,
            ),
          ),
        ].map((fieldName) => {
          if (fieldName.endsWith('.*')) {
            const regex = new RegExp(
              `^${escapeRegExp(fieldName).replace('\\.\\*', '\\.\\d+\\.[^.]+')}$`,
            );

            const valueMap = unflatten(
              Object.fromEntries(
                Object.entries(flattenContent).filter(([keyPath]) => !!keyPath.match(regex)),
              ),
            );

            return [fieldName, valueMap[Object.keys(valueMap)[0]]];
          }

          if (fieldName === 'slug') {
            return [fieldName, refEntry.slug];
          }

          const relFieldConfig = /** @type {RelationField} */ (
            getFieldByKeyPath(fieldConfig.collection, undefined, fieldName, {})
          );

          const value = flattenContent[fieldName.replace(/^fields\./, '')];

          // Resolve the displayed value for a nested relation field
          // @todo Add test for this
          if (relFieldConfig?.widget === 'relation') {
            const nestedRefEntries = getEntriesByCollection(relFieldConfig.collection);
            const nestedRefOptions = getOptions(locale, relFieldConfig, nestedRefEntries);
            const nestedRefValue = nestedRefOptions.find((option) => option.value === value)?.label;

            return [fieldName, nestedRefValue || value];
          }

          return [fieldName, value];
        }),
      );

      /**
       * The number of options.
       */
      const count = Math.max(
        ...Object.values(replacers).map((value) => (Array.isArray(value) ? value.length : 1)),
      );

      let labels = new Array(count).fill(_displayField);
      let values = new Array(count).fill(_valueField);

      Object.entries(replacers).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((valueMap, valueIndex) => {
            Object.entries(valueMap).forEach(([k, v]) => {
              labels.forEach((_label, labelIndex) => {
                if (valueIndex % labelIndex === 0) {
                  labels[valueIndex] = labels[valueIndex].replaceAll(`{{${key}.${k}}}`, v);
                  values[valueIndex] = values[valueIndex].replaceAll(`{{${key}.${k}}}`, v);
                }
              });
            });
          });
        } else {
          labels = labels.map((l) => l.replaceAll(`{{${key}}}`, value));
          values = values.map((v) => v.replaceAll(`{{${key}}}`, value));
        }
      });

      return labels.map((label, index) => ({ label, value: values[index] }));
    })
    .flat(1)
    .sort((a, b) => a.label.localeCompare(b.label));
};
