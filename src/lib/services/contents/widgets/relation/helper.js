import { unique } from '@sveltia/utils/array';
import { compare, escapeRegExp } from '@sveltia/utils/string';
import { unflatten } from 'flat';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';

/**
 * @import { Entry, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField } from '$lib/types/public';
 */

/**
 * Enclose the given field name in brackets if it doesn’t contain any brackets.
 * @param {string} fieldName Field name e.g. `{{name.first}}` or `name.first`.
 * @returns {string} Bracketed field name, e.g. `{{name.first}}`.
 */
const normalizeFieldName = (fieldName) => {
  if (/{{.+?}}/.test(fieldName)) {
    return fieldName;
  }

  if (fieldName === 'slug') {
    // Avoid confusion with `{{slug}}`, which is the entry slug, not the `slug` field
    return '{{fields.slug}}';
  }

  return `{{${fieldName}}}`;
};

/**
 * @type {Map<string, { label: string, value: any }[]>}
 */
const optionCacheMap = new Map();

/**
 * Get options for a Relation field.
 * @param {InternalLocaleCode} locale Current locale.
 * @param {RelationField} fieldConfig Field configuration.
 * @param {Entry[]} refEntries Referenced entries.
 * @returns {{ label: string, value: any }[]} Options.
 */
export const getOptions = (locale, fieldConfig, refEntries) => {
  const cacheKey = JSON.stringify({ locale, fieldConfig, refEntries });
  const cache = optionCacheMap.get(cacheKey);

  if (cache) {
    return cache;
  }

  const { collection: collectionName, file: fileName, filters } = fieldConfig;
  const collection = getCollection(collectionName);

  if (!collection) {
    optionCacheMap.set(cacheKey, []);

    return [];
  }

  const {
    identifier_field: identifierField = 'title',
    _i18n: { defaultLocale },
  } = collection;

  /**
   * @example 'userId'
   * @example 'name.first'
   * @example 'cities.*.id'
   * @example '{{cities.*.id}}'
   * @example 'slug' (`slug` field)
   * @example '{{slug}}' (entry slug)
   * @example '{{locale}}/{{slug}}'
   * @example '{{fields.slug}}' (not mentioned in the Netlify/Decap CMS doc but Sveltia CMS supports
   * the `fields.` prefix for compatibility with other config options)
   */
  const valueField = fieldConfig.value_field;
  /**
   * @example ['userId']
   * @example ['name.first'] (nested)
   * @example ['cities.*.id', 'cities.*.name'] (with wildcard, multiple)
   * @example ['{{twitterHandle}} - {{followerCount}}'] (template)
   */
  const displayFields = fieldConfig.display_fields ?? [valueField ?? `{{${identifierField}}}`];
  /**
   * The format is the same as {@link displayFields}.
   */
  const searchFields = fieldConfig.search_fields ?? displayFields;
  /**
   * Canonical, templatized value field.
   * @example '{{name.first}}'
   * @example '{{route}}#{{sections.*.name}}'
   */
  const _valueField = normalizeFieldName(valueField ?? '{{slug}}');
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
  const entryFilters = filters ?? [];

  const options = refEntries
    .map((refEntry) => {
      // Fall back to the default locale if needed
      const { content } = refEntry.locales[locale] ?? refEntry.locales._default ?? {};

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
      const { slug, locales } = refEntry;
      const getFieldConfigArgs = { collectionName, fileName };

      /**
       * Wrapper for {@link getFieldDisplayValue}.
       * @param {FieldKeyPath} keyPath Field key path.
       * @param {InternalLocaleCode} [_locale] Target locale.
       * @returns {string} Display value.
       */
      const getDisplayValue = (keyPath, _locale) =>
        getFieldDisplayValue({
          ...getFieldConfigArgs,
          keyPath,
          valueMap: _locale ? locales[_locale].content : content,
          locale: _locale ?? locale,
        });

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
            return [fieldName, slug];
          }

          if (fieldName === 'locale') {
            return [fieldName, locale];
          }

          const keyPath = fieldName.replace(/^fields\./, '');

          const label =
            getDisplayValue(keyPath) ??
            // Fall back if needed
            getDisplayValue(keyPath, defaultLocale) ??
            getEntrySummaryFromContent(content, { identifierField }) ??
            getEntrySummaryFromContent(locales[defaultLocale].content, { identifierField }) ??
            slug;

          return [fieldName, label];
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
                if ((index === 0 && labelIndex === 0) || index % labelIndex === 0) {
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
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {FlattenedEntryContent} args.valueMap Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath Field key path, e.g. `author.name`.
 * @param {InternalLocaleCode} args.locale Locale.
 * @returns {any | any[]} Resolved field value(s).
 * @todo Write tests for this.
 */
export const getReferencedOptionLabel = ({ fieldConfig, valueMap, keyPath, locale }) => {
  const { multiple, collection } = fieldConfig;
  const refEntries = getEntriesByCollection(collection);
  const refOptions = getOptions(locale, fieldConfig, refEntries);
  /**
   * Get the label by value.
   * @param {any} _value Stored value.
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
