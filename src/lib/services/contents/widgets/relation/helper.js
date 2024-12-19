import { unique } from '@sveltia/utils/array';
import { compare, escapeRegExp } from '@sveltia/utils/string';
import { unflatten } from 'flat';
import { getFieldConfig } from '$lib/services/contents/entry/fields';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';

/**
 * Enclose the given field name in brackets if it doesn’t contain any brackets.
 * @param {string} fieldName - Field name e.g. `{{name.first}}` or `name.first`.
 * @returns {string} Bracketed field name, e.g. `{{name.first}}`.
 */
const normalizeFieldName = (fieldName) =>
  /{{.+?}}/.test(fieldName) ? fieldName : `{{${fieldName}}}`;

/**
 * @type {Map<string, { label: string, value: any }[]>}
 */
const optionCacheMap = new Map();

/**
 * Get options for a Relation field.
 * @param {LocaleCode} locale - Current locale.
 * @param {RelationField} fieldConfig - Field configuration.
 * @param {Entry[]} refEntries - Referenced entries.
 * @returns {{ label: string, value: any }[]} Options.
 */
export const getOptions = (locale, fieldConfig, refEntries) => {
  const cacheKey = JSON.stringify({ locale, fieldConfig, refEntries });
  const cache = optionCacheMap.get(cacheKey);

  if (cache) {
    return cache;
  }

  /**
   * @example 'userId'
   * @example 'name.first'
   * @example 'cities.*.id'
   * @example '{{cities.*.id}}'
   * @example '{{slug}}'
   * @example '{{fields.slug}}'
   */
  // @ts-ignore Netlify/Decap CMS supports camelcase field name
  const valueField = fieldConfig.value_field ?? fieldConfig.valueField;
  /**
   * @example ['userId']
   * @example ['name.first'] (nested)
   * @example ['cities.*.id', 'cities.*.name'] (with wildcard, multiple)
   * @example ['{{twitterHandle}} - {{followerCount}}'] (template)
   */
  // @ts-ignore Netlify/Decap CMS supports camelcase field name
  const displayFields = fieldConfig.display_fields ?? fieldConfig.displayFields ?? [valueField];
  /**
   * The format is the same as {@link displayFields}.
   */
  // @ts-ignore Netlify/Decap CMS supports camelcase field name
  const searchFields = fieldConfig.search_fields ?? fieldConfig.searchFields ?? displayFields;
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
  const _displayField = displayFields.map(normalizeFieldName).join(' ');
  /**
   * Canonical, templatized search field.
   */
  const _searchField = searchFields.map(normalizeFieldName).join(' ');
  /**
   * Entry filters.
   */
  const entryFilters = fieldConfig.filters ?? [];

  const options = refEntries
    .map((refEntry) => {
      // Fall back to the default locale if needed
      const { content } = refEntry?.locales[locale] ?? refEntry?.locales._default ?? {};

      return {
        refEntry,
        hasContent: !!content,
        content: content ?? {},
      };
    })
    .filter(
      ({ hasContent, content }) =>
        hasContent && entryFilters.every(({ field, values }) => values.includes(content[field])),
    )
    .map(({ refEntry, content }) => {
      /**
       * Map of replacing values. For a list widget, the key is a _partial_ key path like `cities.*`
       * instead of `cities.*.id` or `cities.*.name`, and the value is a key-value map, so that
       * multiple references can be replaced at once. Otherwise, the key is a complete key path
       * except for `slug`, and the value is the actual value.
       * @type {Record<string, string | number | object[]>}
       */
      const replacers = Object.fromEntries(
        unique(
          [
            ...[..._displayField.matchAll(/{{(.+?)}}/g)].map((m) => m[1]),
            ...[..._valueField.matchAll(/{{(.+?)}}/g)].map((m) => m[1]),
            ...[..._searchField.matchAll(/{{(.+?)}}/g)].map((m) => m[1]),
          ].map((fieldName) =>
            fieldName.includes('.')
              ? fieldName.replace(/^([^.]+)+\.\*\.[^.]+$/, '$1.*')
              : fieldName,
          ),
        ).map((/** @type {string} */ fieldName) => {
          if (fieldName.endsWith('.*')) {
            const regex = new RegExp(
              `^${escapeRegExp(fieldName).replace('\\.\\*', '\\.\\d+\\.[^.]+')}$`,
            );

            const valueMap = unflatten(
              Object.fromEntries(
                Object.entries(content).filter(([keyPath]) => regex.test(keyPath)),
              ),
            );

            return [fieldName, valueMap[Object.keys(valueMap)[0]] ?? ''];
          }

          if (fieldName === 'slug') {
            return [fieldName, refEntry.slug];
          }

          const _fieldConfig = getFieldConfig({
            collectionName: fieldConfig.collection,
            keyPath: fieldName,
          });

          const keyPath = fieldName.replace(/^fields\./, '');
          const value = content[keyPath];

          // Resolve the displayed value for a nested relation field
          if (_fieldConfig?.widget === 'relation') {
            return [
              fieldName,
              // eslint-disable-next-line no-use-before-define
              getReferencedOptionLabel({
                fieldConfig: /** @type {RelationField} */ (_fieldConfig),
                valueMap: content,
                keyPath,
                locale,
              }) ?? '',
            ];
          }

          return [fieldName, value ?? ''];
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
      let searchValues = new Array(count).fill(_searchField);

      Object.entries(replacers).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((valueMap, index) => {
            Object.entries(valueMap).forEach(([k, v]) => {
              labels.forEach((_label, labelIndex) => {
                if (index % labelIndex === 0) {
                  labels[index] = labels[index].replaceAll(`{{${key}.${k}}}`, v);
                  values[index] = values[index].replaceAll(`{{${key}.${k}}}`, v);
                  searchValues[index] = searchValues[index].replaceAll(`{{${key}.${k}}}`, v);
                }
              });
            });
          });
        } else {
          labels = labels.map((l) => l.replaceAll(`{{${key}}}`, value));
          values = values.map((v) => v.replaceAll(`{{${key}}}`, value));
          searchValues = searchValues.map((v) => v.replaceAll(`{{${key}}}`, value));
        }
      });

      return labels.map((label, index) => ({
        label,
        value: values[index],
        searchValue: searchValues[index],
      }));
    })
    .flat(1)
    .sort((a, b) => compare(a.label, b.label));

  optionCacheMap.set(cacheKey, options);

  return options;
};

/**
 * Resolve the display value(s) for a relation field.
 * @param {object} args - Arguments.
 * @param {RelationField} args.fieldConfig - Field configuration.
 * @param {FlattenedEntryContent} args.valueMap - Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath - Field key path, e.g. `author.name`.
 * @param {LocaleCode} args.locale - Locale.
 * @returns {any | any[]} Resolved field value(s).
 * @todo Write tests for this.
 */
export const getReferencedOptionLabel = ({ fieldConfig, valueMap, keyPath, locale }) => {
  const { multiple, collection } = fieldConfig;
  const refEntries = getEntriesByCollection(collection);
  const refOptions = getOptions(locale, fieldConfig, refEntries);
  /**
   * Get the label by value.
   * @param {any} _value - Stored value.
   * @returns {string} Label.
   */
  const getLabel = (_value) => refOptions.find((o) => o.value === _value)?.label || _value;

  if (multiple) {
    const values = Object.entries(valueMap)
      .filter(([key]) => key.match(`^${escapeRegExp(keyPath)}\\.\\d+$`))
      .map(([, _value]) => _value);

    return values.map(getLabel);
  }

  return getLabel(valueMap[keyPath]);
};
