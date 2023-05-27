import { flatten, unflatten } from 'flat';
import { escapeRegExp } from '$lib/services/utils/strings';

/**
 * Get options for a Relation field.
 * @param {LocaleCode} locale Current locale.
 * @param {RelationField} fieldConfig Field configuration.
 * @param {Entry[]} refEntries Referenced entries.
 * @returns {{ label: string, value: any }[]} Options.
 */
export const getOptions = (locale, fieldConfig, refEntries) => {
  /**
   * @example 'userId', 'name.first', 'cities.*.id', '{{slug}}'
   */
  const valueField = fieldConfig.value_field;
  /**
   * @example ['userId'], ['name.first'] (nested), ['cities.*.id', 'cities.*.name'] (with wildcard,
   * multiple), ['{{twitterHandle}} - {{followerCount}}'] (template).
   */
  const displayFields = fieldConfig.display_fields;

  return refEntries
    .map((refEntry) => {
      const { content } = refEntry.locales[locale] || {};

      if (!content) {
        return undefined;
      }

      const flattenContent = flatten(content);

      /**
       * Canonical, templatized display field
       * @example '{{twitterHandle}} {{followerCount}}', '{{sections.*.name}}',
       * '{{route}}: {{sections.*.name}} ({{sections.*.id}})'
       */
      const displayField = (displayFields || [valueField])
        .map((fieldName) => (fieldName.match(/{{.+?}}/) ? fieldName : `{{${fieldName}}}`))
        .join(' ');

      /**
       * Map of replacing values. For a list widget, the key is a _partial_ key path like `cities.*`
       * instead of `cities.*.id` or `cities.*.name`, and the value is a key-value map, so that
       * multiple references can be replaced at once. Otherwise, the key is a complete key path
       * except for `{{slug}}`, and the value is the actual value.
       */
      const replacers = Object.fromEntries(
        [
          ...new Set(
            [...[...displayField.matchAll(/{{(.+?)}}/g)].map((m) => m[1]), valueField].map(
              (fieldName) =>
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

          return [fieldName, fieldName === '{{slug}}' ? refEntry.slug : flattenContent[fieldName]];
        }),
      );

      /**
       * The number of options.
       */
      const count = Math.max(
        ...Object.values(replacers).map((value) => (Array.isArray(value) ? value.length : 1)),
      );

      let labels = new Array(count).fill(displayField);
      let values = new Array(count).fill(valueField);

      Object.entries(replacers).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((valueMap, valueIndex) => {
            Object.entries(valueMap).forEach(([k, v]) => {
              labels.forEach((_label, labelIndex) => {
                if (valueIndex % labelIndex === 0) {
                  labels[valueIndex] = labels[valueIndex].replaceAll(`{{${key}.${k}}}`, v);
                  values[valueIndex] = values[valueIndex].replaceAll(`${key}.${k}`, v);
                }
              });
            });
          });
        } else {
          labels = labels.map((l) => l.replaceAll(`{{${key}}}`, value));
          values = values.map((v) => v.replaceAll(key, value));
        }
      });

      return labels.map((label, index) => ({ label, value: values[index] }));
    })
    .flat(1)
    .sort((a, b) => a.label.localeCompare(b.label));
};
