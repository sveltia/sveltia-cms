import { unique } from '@sveltia/utils/array';
import { compare, escapeRegExp } from '@sveltia/utils/string';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { getFieldConfig, getFieldDisplayValue } from '$lib/services/contents/entry/fields';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';

/**
 * @import { Entry, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField } from '$lib/types/public';
 */

/**
 * @typedef {{ label: string, value: any, searchValue: string }} RelationOption
 */

/**
 * @type {Map<string, RelationOption[]>}
 */
export const optionCacheMap = new Map();

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
 * Determines the type of list field based on the field configuration.
 * @param {any} fieldConfig Field configuration object.
 * @returns {object} Object with boolean flags for different list field types.
 */
const getListFieldTypes = (fieldConfig) => {
  if (!fieldConfig) {
    return {
      isSimpleListField: false,
      isSingleSubfieldListField: false,
    };
  }

  const isListWidget = fieldConfig.widget === 'list';
  const hasField = !!fieldConfig.field;
  const hasFields = !!fieldConfig.fields;
  const hasTypes = !!fieldConfig.types;

  return {
    isSimpleListField: isListWidget && !hasField && !hasFields && !hasTypes,
    isSingleSubfieldListField: isListWidget && hasField && !hasFields && !hasTypes,
  };
};

/**
 * Gets the replacement value for a field name based on standard field types.
 * @param {string} fieldName The field name to get replacement for.
 * @param {any} context Context object containing `slug`, `locale`, and `getDisplayValue` function.
 * @param {any} fallbackContext Fallback context for additional content.
 * @returns {string} The replacement value.
 */
const getFieldReplacement = (fieldName, context, fallbackContext) => {
  const { slug, locale, getDisplayValue } = context;
  const { content, locales, defaultLocale, identifierField } = fallbackContext;

  if (fieldName === 'slug') {
    return slug;
  }

  if (fieldName === 'locale') {
    return locale;
  }

  const keyPath = fieldName.replace(/^fields\./, '');

  return (
    getDisplayValue(keyPath) ||
    getDisplayValue(keyPath, defaultLocale) ||
    getEntrySummaryFromContent(content, { identifierField }) ||
    getEntrySummaryFromContent(locales[defaultLocale]?.content || {}, {
      identifierField,
    }) ||
    slug
  );
};

/**
 * Replaces all template tags in the given strings with actual values.
 * @param {any} templates Object containing `label`, `value`, and `searchValue` templates.
 * @param {string[]} fieldNames Array of field names to replace.
 * @param {any} context Context object for replacements.
 * @param {any} fallbackContext Fallback context for additional content.
 * @returns {any} Object with replaced `label`, `value`, and `searchValue`.
 */
const replaceTemplateFields = (templates, fieldNames, context, fallbackContext) => {
  let { label, value, searchValue } = templates;

  fieldNames.forEach((fieldName) => {
    const replacement = getFieldReplacement(fieldName, context, fallbackContext);

    label = label.replaceAll(`{{${fieldName}}}`, replacement);
    value = value.replaceAll(`{{${fieldName}}}`, replacement);
    searchValue = searchValue.replaceAll(`{{${fieldName}}}`, replacement);
  });

  return { label, value, searchValue };
};

/**
 * Get options for a Relation field.
 * @param {InternalLocaleCode} locale Current locale.
 * @param {RelationField} fieldConfig Field configuration.
 * @param {Entry[]} refEntries Referenced entries.
 * @returns {RelationOption[]} Options.
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
        hasContent: !!content && Object.keys(content).length > 0,
        content: content ?? {},
      };
    })
    .filter(
      ({ hasContent, content }) =>
        hasContent && entryFilters.every(({ field, values }) => values.includes(content[field])),
    )
    .map(({ refEntry, content }) => {
      const { slug, locales } = refEntry;
      const isIndexFile = isCollectionIndexFile(collection, refEntry);
      const getFieldConfigArgs = { collectionName, fileName, isIndexFile };

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

      // Extract all field names from templates
      const allFieldNames = unique([
        ...[..._displayField.matchAll(/{{(.+?)}}/g)].map((m) => m[1]),
        ...[..._valueField.matchAll(/{{(.+?)}}/g)].map((m) => m[1]),
        ...[..._searchField.matchAll(/{{(.+?)}}/g)].map((m) => m[1]),
      ]);

      // Check if any field has wildcards (list fields)
      const hasListFields = allFieldNames.some((name) => name.includes('*'));

      if (!hasListFields) {
        // Simple case: no list fields, create single option
        const replacers = Object.fromEntries(
          allFieldNames.map((fieldName) => {
            const context = { slug, locale, getDisplayValue };
            const fallbackContext = { content, locales, defaultLocale, identifierField };

            return [fieldName, getFieldReplacement(fieldName, context, fallbackContext)];
          }),
        );

        let label = _displayField;
        let value = _valueField;
        let searchValue = _searchField;

        Object.entries(replacers).forEach(([key, val]) => {
          label = label.replaceAll(`{{${key}}}`, val);
          value = value.replaceAll(`{{${key}}}`, val);
          searchValue = searchValue.replaceAll(`{{${key}}}`, val);
        });

        // Handle empty label fallback
        if (!label || label.trim() === '') {
          label =
            getEntrySummaryFromContent(content, { identifierField }) ||
            getEntrySummaryFromContent(locales[defaultLocale]?.content || {}, {
              identifierField,
            }) ||
            slug;
        }

        return [
          {
            label: label || '',
            value: value || slug,
            searchValue: searchValue || label || '',
          },
        ];
      }

      // Complex case: handle list fields
      /** @type {RelationOption[]} */
      const results = [];
      const listFieldConfigs = new Map();

      // First, analyze all list fields and get their configurations
      allFieldNames.forEach((fieldName) => {
        if (fieldName.includes('*')) {
          const baseFieldName = fieldName.replace(/\.\*.*$/, '');

          const fieldConfigForList = getFieldConfig({
            ...getFieldConfigArgs,
            keyPath: baseFieldName,
          });

          listFieldConfigs.set(fieldName, {
            baseFieldName,
            fieldConfig: fieldConfigForList,
            ...getListFieldTypes(fieldConfigForList),
          });
        }
      });

      // Handle different list field scenarios
      const listFieldEntries = Array.from(listFieldConfigs.entries());

      if (listFieldEntries.length === 1) {
        const [fieldName, config] = listFieldEntries[0];

        if (config.isSingleSubfieldListField) {
          // Single subfield list: join all values into one option (e.g., `skills.*`)
          const regex = new RegExp(`^${escapeRegExp(config.baseFieldName)}\\.\\d+$`);

          const values = Object.entries(content)
            .filter(([k]) => regex.test(k))
            .map(([, v]) => v);

          const joinedValue = values.join(' ');

          const templates = {
            label: _displayField.replaceAll(`{{${fieldName}}}`, joinedValue),
            value: _valueField.replaceAll(`{{${fieldName}}}`, joinedValue),
            searchValue: _searchField.replaceAll(`{{${fieldName}}}`, joinedValue),
          };

          const { label, value, searchValue } = replaceTemplateFields(
            templates,
            allFieldNames.filter((name) => !name.includes('.*')),
            { slug, locale, getDisplayValue },
            { content, locales, defaultLocale, identifierField },
          );

          return [
            {
              label: label || '',
              value: value || slug,
              searchValue: searchValue || label || '',
            },
          ];
        }

        // Complex list field: create separate option for each list item (e.g., `cities.*.name`)
        const subFieldMatch = fieldName.match(/^([^.]+)\.\*\.([^.]+)$/);

        if (subFieldMatch) {
          const [, baseFieldNameForList, subKey] = subFieldMatch;

          const regex = new RegExp(
            `^${escapeRegExp(baseFieldNameForList)}\\.\\d+\\.${escapeRegExp(subKey)}$`,
          );

          const listValues = Object.entries(content)
            .filter(([k]) => regex.test(k))
            .map(([k, v]) => {
              const indexRegex = new RegExp(
                `^${escapeRegExp(baseFieldNameForList)}\\.([0-9]+)\\.${escapeRegExp(subKey)}$`,
              );

              const indexMatch = k.match(indexRegex);

              return { index: parseInt(indexMatch?.[1] || '0', 10), value: v };
            })
            .sort((a, b) => a.index - b.index);

          listValues.forEach(({ value: listValue }) => {
            const templates = {
              label: _displayField.replaceAll(`{{${fieldName}}}`, listValue),
              value: _valueField.replaceAll(`{{${fieldName}}}`, listValue),
              searchValue: _searchField.replaceAll(`{{${fieldName}}}`, listValue),
            };

            const { label, value, searchValue } = replaceTemplateFields(
              templates,
              allFieldNames.filter((name) => !name.includes('.*')),
              { slug, locale, getDisplayValue },
              { content, locales, defaultLocale, identifierField },
            );

            results.push({
              label: label || '',
              value: value || slug,
              searchValue: searchValue || label || '',
            });
          });

          return results;
        }
      }

      // Fallback for complex multi-list scenarios or unhandled cases
      const templates = { label: _displayField, value: _valueField, searchValue: _searchField };

      const { label, value, searchValue } = replaceTemplateFields(
        templates,
        allFieldNames,
        { slug, locale, getDisplayValue },
        { content, locales, defaultLocale, identifierField },
      );

      return [
        {
          label: label || '',
          value: value || slug,
          searchValue: searchValue || label || '',
        },
      ];
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
