import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import { hasField } from '$lib/services/config/parser/utils/fields';
import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';
import { DEFAULT_CANONICAL_SLUG } from '$lib/services/contents/i18n/config/constants';
import { mergeI18nConfigs } from '$lib/services/contents/i18n/config/merge';

/**
 * @import {
 * ConfigParserCollectors,
 * ConfigParserContext,
 * FieldParserArgs,
 * InternalSingletonCollection,
 * UnsupportedOption,
 * } from '$lib/types/private';
 * @import {
 * CmsConfig,
 * Collection,
 * CollectionDivider,
 * CollectionFile,
 * EntryCollection,
 * Field,
 * RelationField,
 * } from '$lib/types/public';
 */

/**
 * Template tags that can be used in the `value_field` option but don’t refer to a field in the
 * referenced collection or file: `{{slug}}` is the entry slug and `{{locale}}` is the locale of the
 * entry. Note that the `slug` field of an entry is referenced as `{{fields.slug}}` or `slug`.
 * @type {string[]}
 */
const SPECIAL_TEMPLATE_TAGS = ['slug', 'locale'];

/**
 * Unsupported options for Relation fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  // Deprecated camelCase options in Netlify/Decap CMS config, should be converted to snake_case.
  { prop: 'displayFields', newProp: 'display_fields' },
  { prop: 'searchFields', newProp: 'search_fields' },
  { prop: 'valueField', newProp: 'value_field' },
  // Sveltia CMS doesn’t have performance issues with many related entries, so this option is not
  // applicable.
  { type: 'warning', prop: 'options_length', strKey: 'unsupported_ignored_option' },
];

/**
 * Get the canonical slug key for the referenced collection or file. When i18n is enabled, the key —
 * `translationKey` by default — is added to the content of each localized entry, allowing entries
 * to be matched across locales. It can therefore be used as the `value_field` of a Relation field
 * even though it’s not defined as a field.
 * @param {object} args Arguments.
 * @param {CmsConfig | undefined} args.cmsConfig The site configuration.
 * @param {Collection | CollectionDivider | InternalSingletonCollection} args.collection Referenced
 * collection.
 * @param {CollectionFile} [args.file] Referenced collection file, if the collection is a file
 * collection.
 * @returns {string | undefined} The key, or `undefined` if i18n is not enabled for the collection
 * or file.
 * @see https://sveltiacms.app/en/docs/i18n#localizing-entry-slugs
 */
const getCanonicalSlugKey = ({ cmsConfig, collection, file }) => {
  const config = mergeI18nConfigs({ cmsConfig, collection, file });

  if (!config?.locales?.length) {
    return undefined;
  }

  return config.canonical_slug?.key ?? DEFAULT_CANONICAL_SLUG.key;
};

/**
 * Validate the `value_field` option of a Relation field, which refers to one or more fields defined
 * in the referenced collection or file. An unknown key path is not reported at runtime — the widget
 * silently falls back to the entry summary or slug — so the stored values end up being something
 * other than what the configuration asks for.
 * @param {object} args Arguments.
 * @param {string} args.valueField The `value_field` option, e.g. `userId`, `name.first`,
 * `cities.*.id` or `{{locale}}/{{slug}}`.
 * @param {Field[]} args.fields Fields defined in the referenced collection or file.
 * @param {string | undefined} args.canonicalSlugKey The canonical slug key of the referenced
 * collection or file, if i18n is enabled. It’s not a field but a valid `value_field`.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkValueField = ({ valueField, fields, canonicalSlugKey, context, collectors }) => {
  const tags = [...valueField.matchAll(TEMPLATE_TAG_REPLACE_REGEX)].map(([, tag]) => tag);

  // A plain field name like `userId` is equivalent to `{{userId}}`, meaning that `slug` refers to
  // the `slug` field while `{{slug}}` refers to the entry slug
  const keyPaths = tags.length
    ? tags.filter((tag) => !SPECIAL_TEMPLATE_TAGS.includes(tag))
    : [valueField];

  keyPaths.forEach((keyPath) => {
    // The `fields.` prefix is supported for compatibility with other config options
    const key = keyPath.replace(/^fields\./, '');

    if (key !== canonicalSlugKey && !hasField(fields, key)) {
      addMessage({
        strKey: 'relation_field_invalid_value_field',
        context,
        collectors,
        values: { field: keyPath },
      });
    }
  });
};

/**
 * Parse and validate a Relation field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseRelationFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const fieldConfig = /** @type {RelationField} */ (config);
  const { collection: collectionName, file: fileName, value_field: valueField } = fieldConfig;
  const { cmsConfig } = context;

  const collection =
    collectionName === '_singletons'
      ? /** @type {InternalSingletonCollection} */ ({
          name: collectionName,
          files: cmsConfig?.singletons,
        })
      : cmsConfig?.collections?.find((col) => col.name === collectionName);

  /** @type {CollectionFile | undefined} */
  let file = undefined;
  /** @type {string | undefined} */
  let canonicalSlugKey = undefined;

  // Check if the collection exists
  if (collection) {
    const hasFiles = 'files' in collection && Array.isArray(collection.files);

    if (fileName) {
      // Check if the file exists in the collection
      if (hasFiles) {
        file = /** @type {CollectionFile | undefined} */ (
          collection.files.find((f) => 'file' in f && f.name === fileName)
        );
      }

      if (!file) {
        addMessage({
          strKey: 'relation_field_invalid_collection_file',
          context,
          collectors,
          values: { file: fileName },
        });
      }
    } else if (hasFiles) {
      addMessage({
        strKey: 'relation_field_missing_file_name',
        context,
        collectors,
        values: { collection: collectionName },
      });
    }

    canonicalSlugKey = getCanonicalSlugKey({ cmsConfig, collection, file });
  } else {
    addMessage({
      strKey: 'relation_field_invalid_collection',
      context,
      collectors,
      values: { collection: collectionName },
    });
  }

  // Check if the `value_field` exists in the target collection/file. A collection or file without
  // fields is reported separately, so skip the check in that case to avoid a duplicate error
  const targetFields = fileName
    ? file?.fields
    : /** @type {EntryCollection | undefined} */ (collection)?.fields;

  if (typeof valueField === 'string' && valueField && targetFields?.length) {
    checkValueField({ valueField, fields: targetFields, canonicalSlugKey, context, collectors });
  }

  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });

  // Collect relation information for later processing
  collectors.relationFields.add({ fieldConfig, context });
};
