import { escapeRegExp } from '@sveltia/utils/string';

import { collectors } from '$lib/services/config';
import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { getField } from '$lib/services/contents/entry/fields';
import { getListItemKeys } from '$lib/services/contents/entry/key-paths';
import { getEntryOptions } from '$lib/services/contents/fields/relation/helpers';

/**
 * @import {
 * CollectedRelationField,
 * ConfigParserContext,
 * Entry,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * ResolvedRelationField,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, ListFieldWithSubField, RelationField } from '$lib/types/public';
 */

/**
 * Check whether the given stored value is absent. `false`, `0` and an empty string are all valid
 * relation values, so only `undefined` and `null` count as absent.
 * @param {any} value Value to check.
 * @returns {boolean} Whether the value is absent.
 */
const isNullish = (value) => value === undefined || value === null;

/**
 * Drop the subfield names of single-subfield List fields from the given typed key path. The parser
 * records the subfield name after the list item wildcard, e.g. `authors.*.author`, but the item
 * value is stored directly under the item index, e.g. `authors.0`.
 * @param {ConfigParserContext} context Field parser context.
 * @returns {string} Typed key path in the shape of the flattened content, e.g. `authors.*`.
 */
const getContentTypedKeyPath = ({
  collection,
  collectionFile,
  componentName,
  isIndexFile,
  typedKeyPath = '',
}) => {
  const segments = typedKeyPath.split('.');

  if (!segments.includes('*')) {
    return typedKeyPath;
  }

  const getFieldArgs = {
    collectionName: /** @type {string} */ (collection?.name),
    fileName: collectionFile?.name,
    componentName,
    isIndexFile,
  };

  /** @type {string[]} */
  const contentSegments = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    if (segment === '*' && contentSegments.length) {
      const listField = getField({ ...getFieldArgs, keyPath: contentSegments.join('.') });
      const { field: subField } = /** @type {ListFieldWithSubField} */ (listField ?? {});

      contentSegments.push(segment);

      if (listField?.widget === 'list' && subField?.name === segments[index + 1]) {
        // Skip the subfield name
        index += 1;
      }
    } else {
      contentSegments.push(segment);
    }
  }

  return contentSegments.join('.');
};

/**
 * Resolve the key path of a Relation field within an entry’s flattened content, from the parser
 * context recorded while the config was parsed.
 * @param {CollectedRelationField} collected Collected Relation field.
 * @returns {{ keyPath: FieldKeyPath, valuePattern: RegExp | undefined }} Key path and, when it
 * contains a `*` wildcard, a pattern matching the concrete key paths holding the field’s values.
 */
export const resolveRelationKeyPath = ({ fieldConfig, context }) => {
  // The `typedKeyPath` may carry type annotations like `blocks.*<image>.src`; strip them. A `*`
  // stands for a list item index and is kept, because the field then occurs once per list item
  const keyPath = getContentTypedKeyPath(context).replace(/<[^>]+>/g, '') || fieldConfig.name;

  if (!keyPath.includes('*')) {
    return { keyPath, valuePattern: undefined };
  }

  // A multi-value field stores each of its values under its own index, one level below the field’s
  // own key path, e.g. `blocks.0.tags.0`
  const suffix = fieldConfig.multiple ? '\\.\\d+' : '';

  return {
    keyPath,
    valuePattern: new RegExp(`^${escapeRegExp(keyPath).replace(/\\\*/g, '\\d+')}${suffix}$`),
  };
};

/**
 * Get the concrete key paths holding a Relation field’s stored values in the given content map. A
 * multi-value field expands to one key path per value, and a field nested in a list expands to one
 * set of key paths per list item.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Flattened entry content.
 * @param {FieldKeyPath} args.keyPath Field key path, possibly containing `*` wildcards.
 * @param {RegExp} [args.valuePattern] Pattern from {@link resolveRelationKeyPath}, required when
 * the key path contains a wildcard.
 * @param {boolean} [args.multiple] Whether the field accepts multiple values.
 * @returns {FieldKeyPath[]} Key paths whose values are relation references.
 */
export const getRelationKeyPaths = ({ content, keyPath, valuePattern, multiple = false }) => {
  // A wildcard key path can only be expanded by looking at the content’s own key paths
  if (valuePattern) {
    return Object.keys(content).filter((key) => valuePattern.test(key) && !isNullish(content[key]));
  }

  if (multiple) {
    return getListItemKeys(content, keyPath).filter((key) => !isNullish(content[key]));
  }

  return isNullish(content[keyPath]) ? [] : [keyPath];
};

/**
 * Get the stored relation values for a field in a given entry content map.
 * @param {object} args Arguments. Same as {@link getRelationKeyPaths}.
 * @param {FlattenedEntryContent} args.content Flattened entry content.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {RegExp} [args.valuePattern] Wildcard key path pattern.
 * @param {boolean} [args.multiple] Whether the field accepts multiple values.
 * @returns {any[]} Stored values.
 */
export const getRelationValues = (args) =>
  getRelationKeyPaths(args).map((key) => args.content[key]);

/**
 * Get the value(s) identifying the given entry in a Relation field, in other words what is stored
 * in the field when the entry is selected. There can be more than one when the field’s
 * `value_field` template references a list field.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Relation field config.
 * @param {Entry} args.entry Referenced entry.
 * @param {InternalLocaleCode} args.locale Locale of the entry holding the Relation field.
 * @returns {any[]} Stored values.
 */
export const getEntryRelationValues = ({ fieldConfig, entry, locale }) =>
  getEntryOptions({ locale, fieldConfig, refEntry: entry }).map(({ value }) => value);

/**
 * Find every Relation field configured anywhere in the site that points at the given collection —
 * and, for a file/singleton collection, at the given file — resolved down to the collection and key
 * path where its values are stored.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Target collection name.
 * @param {string} [args.fileName] Target file name, for file/singleton collections.
 * @returns {ResolvedRelationField[]} Resolved Relation fields. Fields whose holding collection is
 * no longer configured are omitted.
 */
export const getReferencingRelationFields = ({ collectionName, fileName }) =>
  [...collectors.relationFields]
    .filter(
      ({ fieldConfig }) =>
        fieldConfig.collection === collectionName &&
        // A Relation field may target one specific file in a file/singleton collection. When it
        // does, it can only reference the target entry if that’s the very file
        !(fileName && fieldConfig.file && fieldConfig.file !== fileName),
    )
    .map((collected) => {
      const { fieldConfig, context } = collected;
      const sourceCollectionName = context.collection?.name;

      const sourceCollection = sourceCollectionName
        ? getCollection(sourceCollectionName)
        : undefined;

      if (!sourceCollection) {
        return undefined;
      }

      const sourceFileName = context.collectionFile?.name;

      return /** @type {ResolvedRelationField} */ ({
        fieldConfig,
        sourceCollection,
        sourceCollectionFile: sourceFileName
          ? getCollectionFile(sourceCollection, sourceFileName)
          : undefined,
        ...resolveRelationKeyPath(collected),
        multiple: !!fieldConfig.multiple,
      });
    })
    .filter((field) => !!field);
