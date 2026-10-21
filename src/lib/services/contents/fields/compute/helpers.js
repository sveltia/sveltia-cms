import { generateUUID } from '@sveltia/utils/crypto';
import { escapeRegExp } from '@sveltia/utils/string';

import { FIELD_TAG_PREFIX_REGEX, UUID_TYPES } from '$lib/services/common/template/constants';
import { processNestedTemplates } from '$lib/services/common/template/nested';
import { replaceTemplateTags, splitTemplateTags } from '$lib/services/common/template/tags';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';
import { getListItemIndexes, indexListItems } from '$lib/services/contents/entry/content-index';
import { getField } from '$lib/services/contents/entry/fields';
import { getFieldDisplayValue } from '$lib/services/contents/entry/values';
import { evaluateExpression } from '$lib/services/contents/fields/compute/expression';
import {
  getNumberFormatter,
  isFloatType,
  isStringOutput,
  yieldsNumber,
} from '$lib/services/contents/fields/number/helpers';
import { getListFormatter } from '$lib/services/contents/i18n';
import { getOrCreate } from '$lib/services/utils/cache';
import { isNumeric, roundFloatError } from '$lib/services/utils/number';

/**
 * @import {
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * ListItemIndex,
 * StringTransformation,
 * } from '$lib/types/private';
 * @import { ComputeField, Field, FieldKeyPath, LocaleCode } from '$lib/types/public';
 * @import { ListFormatter } from '$lib/services/contents/i18n';
 */

/**
 * UUIDs generated for the Compute fields of a locale’s content, keyed by the content and then by
 * the field’s key path, in the order of the UUID tags in the template. The content maps live as
 * long as the draft does, so a value is generated once per draft; see {@link getUuids}.
 * @type {WeakMap<FlattenedEntryContent, Map<FieldKeyPath, string[]>>}
 */
const generatedUuidMap = new WeakMap();

/**
 * Get the index of the list item the field is in, which is the last numeric segment of the given
 * key path: `2` for `authors.2.slug`, for `lines.2.meta.n` in an Object field of a list item, and
 * for `lines.2`, the item itself of a list with a single subfield. In a nested list, it’s the index
 * of the innermost item, e.g. `3` for `sections.1.authors.3.slug`.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @returns {number | undefined} Index, or `undefined` if the field is not in a list item.
 * @see https://github.com/sveltia/sveltia-cms/issues/172
 */
export const getListIndex = (keyPath) => {
  const index = keyPath.split('.').findLast(isNumeric);

  return index === undefined ? undefined : Number(index);
};

/**
 * Check whether the given template tag is a UUID tag.
 * @param {string} tagName Tag name.
 * @returns {boolean} Result.
 */
const isUuidTag = (tagName) => Object.hasOwn(UUID_TYPES, tagName);

/**
 * A UUID tag found in a value template.
 * @typedef {object} UuidTagInfo
 * @property {string} tagName Tag name: `uuid`, `uuid_short` or `uuid_shorter`.
 * @property {boolean} extractable Whether the UUID can be read back from a value the template has
 * resolved to. Only a tag at either edge of the template can, meaning one before the first or after
 * the last tag of another kind; see {@link parseUuidTags}.
 */

/**
 * Find the UUID tags in the given value template.
 *
 * The returned regular expression matches a value the template has resolved to, capturing the UUIDs
 * that can be told apart from the rest. Any tag of another kind can resolve to anything, so a UUID
 * tag placed between such tags with nothing but their values around it is ambiguous — the UUID
 * could start anywhere in a run of hexadecimal characters — and every such tag along with
 * everything from the first tag of another kind to the last is matched by a single wildcard
 * instead. The single wildcard also keeps the matching linear: one wildcard per tag would make a
 * value that doesn’t match, such as a long one saved before a UUID tag was added to the template,
 * take polynomial time to reject.
 * @param {string} valueTemplate Value template.
 * @returns {{ uuidTags: UuidTagInfo[], regex: RegExp }} UUID tags in the order they appear, and the
 * regular expression, which captures the UUID of each extractable tag in that order.
 */
const parseUuidTags = (valueTemplate) => {
  const { tags, literals: rawLiterals } = splitTemplateTags(valueTemplate);
  const tagNames = tags.map((placeholder) => parseTransformations(placeholder).value);
  const literals = rawLiterals.map(escapeRegExp);
  const firstOtherIndex = tagNames.findIndex((tagName) => !isUuidTag(tagName));
  const lastOtherIndex = tagNames.findLastIndex((tagName) => !isUuidTag(tagName));

  /**
   * Build the part of the regular expression covering the given tags and the literal text around
   * them. The literal at index `i` is the text before tag `i`, and the last one is the trailing
   * text.
   * @param {number} start Index of the first tag.
   * @param {number} end Index after the last tag.
   * @returns {string} Regular expression source.
   */
  const build = (start, end) =>
    tagNames
      .slice(start, end)
      .map((tagName, i) => `${literals[start + i]}(${UUID_TYPES[tagName].pattern})`)
      .join('') + literals[end];

  const source =
    firstOtherIndex === -1
      ? build(0, tagNames.length)
      : `${build(0, firstOtherIndex)}[\\s\\S]*${build(lastOtherIndex + 1, tagNames.length)}`;

  const uuidTags = tagNames
    .map((tagName, index) => ({
      tagName,
      extractable: firstOtherIndex === -1 || index < firstOtherIndex || index > lastOtherIndex,
    }))
    .filter(({ tagName }) => isUuidTag(tagName));

  // An `upper` transformation is the one way a UUID can change while staying recognizable
  return { uuidTags, regex: new RegExp(`^${source}$`, 'i') };
};

/**
 * Check whether the given value template holds a UUID tag: `{{uuid}}`, `{{uuid_short}}` or
 * `{{uuid_shorter}}`.
 * @param {string} [valueTemplate] Value template.
 * @returns {boolean} Result.
 */
export const hasUuidTag = (valueTemplate = '') => parseUuidTags(valueTemplate).uuidTags.length > 0;

/**
 * Get the UUIDs for the UUID tags in the given value template.
 *
 * A UUID has to survive the field being resolved again, which happens whenever anything in the
 * draft changes, or an existing entry would lose the UUID it was saved with and a new entry would
 * get a different one on every keystroke — and, since a changed value triggers another resolution,
 * never settle. So the UUIDs are first taken from the field’s current value, which keeps them
 * across a reload of the entry, a backup restore or a list item being moved. A UUID that can’t be
 * read from the value — because the value is empty, a transformation has altered the UUID’s shape,
 * or the tag sits between tags of another kind — is the one generated for the field earlier in the
 * draft’s life, or a new one if there is none yet.
 * @param {object} args Arguments.
 * @param {string} args.valueTemplate Value template.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content the template is resolved
 * against.
 * @returns {string[]} UUIDs in the order of the tags. Empty if the template has no UUID tag.
 */
const getUuids = ({ valueTemplate, keyPath, valueMap }) => {
  const { uuidTags, regex } = parseUuidTags(valueTemplate);

  if (!uuidTags.length) {
    return [];
  }

  const currentValue = valueMap[keyPath];

  const extractedUuids =
    typeof currentValue === 'string' ? currentValue.match(regex)?.slice(1) : undefined;

  if (extractedUuids?.length === uuidTags.length) {
    return extractedUuids;
  }

  const cache = getOrCreate(generatedUuidMap, valueMap, () => new Map());
  let generatedUuids = cache.get(keyPath);

  if (generatedUuids?.length !== uuidTags.length) {
    generatedUuids = uuidTags.map(({ tagName }) => generateUUID(UUID_TYPES[tagName].length));
    cache.set(keyPath, generatedUuids);
  }

  if (!extractedUuids) {
    return generatedUuids;
  }

  let extractedIndex = 0;

  return uuidTags.map(({ extractable }, index) => {
    if (!extractable) {
      return /** @type {string[]} */ (generatedUuids)[index];
    }

    const uuid = extractedUuids[extractedIndex];

    extractedIndex += 1;

    return uuid;
  });
};

/**
 * Convert the result of a Compute field’s arithmetic expression into the value to be stored,
 * according to the field’s `value_type`. A result with a fraction is rounded to 15 significant
 * digits, so the error of binary floating-point arithmetic doesn’t end up in the file, e.g. `0.3`
 * rather than `0.30000000000000004` for `0.1 * 3`, while an integer is kept as is, as rounding
 * would change a large one. With an integer type, the result is rounded to the nearest integer.
 * @param {number | undefined} result Result of the expression. `undefined` if it can’t be computed.
 * @param {ComputeField} fieldConfig Field configuration.
 * @returns {string | number | null} Value to be stored. A result that can’t be computed, or an
 * integer beyond the range JavaScript can represent exactly, is stored like an empty Number field:
 * `null` for the number types, or an empty string for the string types.
 */
export const getNumericValue = (result, fieldConfig) => {
  // The value type means the same as a Number field’s, including a custom one, which is treated
  // like `int/string`
  const stringOutput = isStringOutput(fieldConfig);
  const integer = !isFloatType(fieldConfig);

  // Adding zero turns `-0` into `0`
  const number =
    result === undefined ? undefined : (integer ? Math.round(result) : roundFloatError(result)) + 0;

  if (number === undefined || (integer && !Number.isSafeInteger(number))) {
    return stringOutput ? '' : null;
  }

  return stringOutput ? String(number) : number;
};

/**
 * Format the given value of a Compute field for display. A number the field yields is formatted
 * like a Number field value, e.g. `1,234.5` for `1234.5` in English.
 * @param {object} args Arguments.
 * @param {string | number | null | undefined} args.value Field value.
 * @param {ComputeField} args.fieldConfig Field configuration.
 * @param {LocaleCode | undefined} args.canonicalLocale Canonical locale code.
 * @returns {string} Formatted value. Empty if the value is empty. A value that isn’t a number, like
 * one saved before the `value_type` option was changed, is returned as is.
 */
export const formatComputedValue = ({ value, fieldConfig, canonicalLocale }) => {
  const string = String(value ?? '');
  const number = Number(value);

  return yieldsNumber(fieldConfig) && string.trim() && Number.isFinite(number)
    ? getNumberFormatter(canonicalLocale).format(number)
    : string;
};

/**
 * Where a `{{fields.*}}` tag of a Compute field is resolved: the content and the rich text editor
 * component, if any, the key path refers to.
 * @typedef {object} FieldTagSource
 * @property {FlattenedEntryContent} valueMap Content holding the field value.
 * @property {string} [componentName] Name of the component whose field the key path refers to.
 * @property {FieldKeyPath} ownKeyPath Key path of the Compute field within the content, or of the
 * rich text field holding the field’s component, which tells the list items the field is in.
 */

/**
 * Indexes of the list items in the content a `{{fields.*}}` tag is resolved against, keyed by the
 * content. A snapshot of the draft is resolved against by every Compute field of the draft, so the
 * index is built once for all of them.
 * @type {WeakMap<FlattenedEntryContent, ListItemIndex>}
 */
const listItemIndexMap = new WeakMap();

/**
 * Resolve the `*` wildcards in the key path of a `{{fields.*}}` tag, like `lines.*.price`. A `*`
 * stands for the current item: the item of that list the Compute field is in, so a field at
 * `lines.2.amount` gets `lines.2.price`. In an aggregate function, the last `*` stands for every
 * item instead, and so does any other `*` that has no current item, so `orders.*.lines.*.amount`
 * gives the amount of every line of the current order, or of every order outside one.
 * @param {object} args Arguments.
 * @param {FieldKeyPath} args.fieldKeyPath Key path of the tag.
 * @param {FieldKeyPath} args.ownKeyPath Key path of the Compute field within the same content.
 * @param {boolean} args.allItems Whether the tag is an argument of an aggregate function.
 * @param {FlattenedEntryContent} args.valueMap Content the tag is resolved against.
 * @returns {FieldKeyPath[]} Key paths without wildcards, in the order of the items. The key path
 * itself if it has no wildcard. Empty if a `*` has no current item outside an aggregate function.
 */
export const expandWildcards = ({ fieldKeyPath, ownKeyPath, allItems, valueMap }) => {
  const segments = fieldKeyPath.split('.');
  const lastWildcardIndex = segments.lastIndexOf('*');

  if (lastWildcardIndex === -1) {
    return [fieldKeyPath];
  }

  const ownSegments = ownKeyPath.split('.');
  /** @type {string[][]} */
  let paths = [[]];

  segments.forEach((segment, index) => {
    if (segment !== '*') {
      paths.forEach((path) => path.push(segment));

      return;
    }

    paths = paths.flatMap((path) => {
      const expand = allItems && index === lastWildcardIndex;
      const ownIndex = ownSegments[index];

      // The field is in an item of this list when its key path starts with the list’s
      const isCurrentItem =
        !expand &&
        isNumeric(ownIndex ?? '') &&
        path.every((pathSegment, segmentIndex) => pathSegment === ownSegments[segmentIndex]);

      if (isCurrentItem) {
        return [[...path, ownIndex]];
      }

      if (!allItems) {
        return [];
      }

      const listIndex = getOrCreate(listItemIndexMap, valueMap, () => indexListItems(valueMap));

      return getListItemIndexes(listIndex, path.join('.')).map((itemIndex) => [
        ...path,
        String(itemIndex),
      ]);
    });
  });

  return paths.map((path) => path.join('.'));
};

/**
 * Get the values of a rich text editor component instance, without its key path prefix.
 * @param {FlattenedEntryContent} valueMap Content of the `extraValues` store.
 * @param {string} keyPathPrefix Key path prefix of the component instance, e.g. `body:c12:`.
 * @returns {FlattenedEntryContent} Component values, e.g. `heading` for `body:c12:heading`.
 */
const getComponentValues = (valueMap, keyPathPrefix) =>
  Object.fromEntries(
    Object.entries(valueMap)
      .filter(([key]) => key.startsWith(keyPathPrefix))
      .map(([key, value]) => [key.slice(keyPathPrefix.length), value]),
  );

/**
 * What a Compute field’s `value` template is resolved against, shared by the functions resolving
 * its template tags; see {@link getComputedValue} for the properties taken from its arguments.
 * @typedef {object} ComputeContext
 * @property {FieldKeyPath} keyPath Key path of the field.
 * @property {InternalLocaleCode} locale Locale code.
 * @property {FlattenedEntryContent} valueMap Flattened entry content, or the content of the
 * `extraValues` store for a field of a rich text editor component.
 * @property {string} collectionName Collection name.
 * @property {string} [fileName] Collection file name.
 * @property {boolean} isIndexFile Whether the entry is the collection’s special index file.
 * @property {string} keyPathPrefix Key path prefix of the rich text editor component instance the
 * field belongs to, or an empty string.
 * @property {FlattenedEntryContent} entryValueMap Flattened entry content, for a field of a rich
 * text editor component.
 * @property {string | undefined} componentName Name of the component the field belongs to.
 * @property {boolean} numeric Whether the template is an arithmetic expression.
 * @property {ListFormatter} listFormatter Formatter for a list of values.
 * @property {FlattenedEntryContent} [componentValues] Values of the component instance, without
 * the key path prefix, once {@link getFieldTagSource} has needed them.
 */

/**
 * Get the content and the component the given key path refers to.
 * @param {ComputeContext} context Context.
 * @param {FieldKeyPath} fieldKeyPath Key path from a `{{fields.*}}` tag.
 * @returns {FieldTagSource} Source.
 */
const getFieldTagSource = (context, fieldKeyPath) => {
  const { keyPath, valueMap, keyPathPrefix, componentName, collectionName, fileName, isIndexFile } =
    context;

  if (!keyPathPrefix) {
    return { valueMap, ownKeyPath: keyPath };
  }

  const getFieldArgs = { collectionName, fileName, isIndexFile, keyPath: fieldKeyPath };

  if (componentName && getField({ ...getFieldArgs, componentName })) {
    context.componentValues ??= getComponentValues(valueMap, keyPathPrefix);

    return {
      valueMap: context.componentValues,
      componentName,
      ownKeyPath: keyPath.slice(keyPathPrefix.length),
    };
  }

  // The component sits in the rich text field whose key path starts the prefix, e.g.
  // `lines.2.body` for `lines.2.body:c12:`, which is in the same list items as the component
  return { valueMap: context.entryValueMap, ownKeyPath: keyPathPrefix.split(':')[0] };
};

/**
 * Check whether the stored value of the given field is inserted as is rather than its display
 * value. That’s a number, including the value of a Compute field that yields one, and, in an
 * arithmetic expression, the stored value of a Select or Relation field, e.g. `5` rather than its
 * label `Express (5)`, including that of an item of a multiple one, which has no display value.
 * @param {Field | undefined} fieldConfig Configuration of the field the tag refers to.
 * @param {boolean} numeric Whether the template is an arithmetic expression.
 * @returns {boolean} Result.
 */
const usesRawValue = (fieldConfig, numeric) =>
  !!fieldConfig &&
  (yieldsNumber(fieldConfig) ||
    (numeric && (fieldConfig.widget === 'select' || fieldConfig.widget === 'relation')));

/**
 * Resolve a `{{fields.*}}` tag for a single field.
 * @param {ComputeContext} context Context.
 * @param {FieldKeyPath} fieldKeyPath Key path of the field, without any `*`, unless it couldn’t be
 * resolved.
 * @param {FieldTagSource} source Where the tag is resolved.
 * @param {StringTransformation[]} transformations Transformations of the tag.
 * @returns {string} Resolved value.
 */
const resolveFieldTag = (context, fieldKeyPath, source, transformations) => {
  const { locale, collectionName, fileName, isIndexFile, numeric, listFormatter } = context;
  const { valueMap: sourceValueMap, componentName: sourceComponentName } = source;

  const getFieldArgs = {
    collectionName,
    fileName,
    componentName: sourceComponentName,
    valueMap: sourceValueMap,
    keyPath: fieldKeyPath,
    isIndexFile,
  };

  // Let `getFieldDisplayValue()` apply the transformations, so they get the raw value and the field
  // configuration: a boolean for `ternary` rather than `'false'`, which is truthy, and the stored
  // date for `date` rather than the localized display value. A value missing from the content, like
  // that of a List field, which is stored under its item key paths, or an unset field, would come
  // back empty whatever the transformations, breaking `default`, so the transformations are applied
  // to its display value instead.
  const rawValue = sourceValueMap[fieldKeyPath];
  const hasRawValue = rawValue !== undefined;

  // A number is inserted as stored rather than formatted for display, so a template like
  // `/p/{{fields.sku}}` doesn’t give `/p/123,456`, and an arithmetic expression can use it
  if (hasRawValue) {
    const sourceFieldConfig = getField(getFieldArgs);

    if (usesRawValue(sourceFieldConfig, numeric)) {
      // The transformations get a string as they would get the display value, so `0` isn’t taken
      // as empty by `default`
      const value = String(rawValue ?? '');

      return transformations.length
        ? applyTransformations({ fieldConfig: sourceFieldConfig, value, transformations, locale })
        : value;
    }
  }

  const fieldValue = getFieldDisplayValue({
    ...getFieldArgs,
    locale,
    transformations: hasRawValue ? transformations : undefined,
  });

  const value = Array.isArray(fieldValue) ? listFormatter.format(fieldValue) : String(fieldValue);

  return !hasRawValue && transformations.length
    ? applyTransformations({ value, transformations, locale })
    : value;
};

/**
 * Resolve the `value` template of a Compute field.
 * @param {object} args Arguments.
 * @param {ComputeField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content the template is resolved
 * against. The field’s own current value is read from it to keep any UUID it holds.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {string} [args.keyPathPrefix] Key path prefix of the rich text editor component instance
 * the field belongs to, e.g. `body:c12:`, in which case {@link args.valueMap} is the content of the
 * `extraValues` store. A `{{fields.*}}` tag then refers to a field of the component, or, if the
 * component has no such field, to a field of the entry.
 * @param {FlattenedEntryContent} [args.entryValueMap] Flattened entry content, for a field of a
 * rich text editor component to refer to a field of the entry.
 * @returns {string | number | null} Computed value. With a numeric `value_type`, see
 * {@link getNumericValue}.
 */
export const getComputedValue = ({
  fieldConfig,
  keyPath,
  locale,
  valueMap,
  collectionName,
  fileName,
  isIndexFile = false,
  keyPathPrefix = '',
  entryValueMap = {},
}) => {
  const { value: valueTemplate = '' } = fieldConfig;
  const numeric = yieldsNumber(fieldConfig);

  // A lone `{{index}}` yields the number itself rather than its string representation, so that the
  // value is written to the file as a number. A numeric `value_type` decides the type itself
  if (!numeric && valueTemplate === '{{index}}') {
    return getListIndex(keyPath) ?? '';
  }

  // A UUID can’t be an operand of an arithmetic expression, and the configuration parser reports
  // one used there, so none is generated
  const uuids = numeric ? [] : getUuids({ valueTemplate, keyPath, valueMap });
  let uuidIndex = 0;

  /** @type {ComputeContext} */
  const context = {
    keyPath,
    locale,
    valueMap,
    collectionName,
    fileName,
    isIndexFile,
    keyPathPrefix,
    entryValueMap,
    componentName: keyPathPrefix ? valueMap[`${keyPathPrefix}__sc_component_name`] : undefined,
    numeric,
    listFormatter: getListFormatter(locale),
  };

  /**
   * Resolve a template tag of the value template.
   * @param {string} placeholder Tag content, e.g. `fields.title | upper`.
   * @param {{ allItems?: boolean }} [options] Options. With `allItems`, the tag is an argument of
   * an aggregate function in an arithmetic expression, and the last `*` in a `{{fields.*}}` tag
   * stands for every item of the list rather than the current one.
   * @returns {string | string[]} Resolved value, or a list of values with `allItems`.
   */
  const resolvePlaceholder = (placeholder, { allItems = false } = {}) => {
    const { value: tagName, transformations: parsedTransformations } =
      parseTransformations(placeholder);

    if (tagName === 'index') {
      const value = String(getListIndex(keyPath) ?? '');

      return allItems ? [value] : value;
    }

    // Resolve the tags in the transformation arguments like the tag itself, e.g. `{{fields.title}}`
    // in `default('{{fields.title}}')`. A UUID tag there resolves to nothing, as the UUIDs are
    // counted only in the template itself and one there would shift the others
    const transformations = processNestedTemplates(parsedTransformations, (innerTag) =>
      isUuidTag(parseTransformations(innerTag).value)
        ? ''
        : /** @type {string} */ (resolvePlaceholder(innerTag)),
    );

    if (FIELD_TAG_PREFIX_REGEX.test(tagName)) {
      const fieldKeyPath = stripFieldTagPrefix(tagName);
      const source = getFieldTagSource(context, fieldKeyPath);

      const fieldKeyPaths = expandWildcards({
        fieldKeyPath,
        ownKeyPath: source.ownKeyPath,
        allItems,
        valueMap: source.valueMap,
      });

      if (allItems) {
        return fieldKeyPaths.map((_keyPath) =>
          resolveFieldTag(context, _keyPath, source, transformations),
        );
      }

      // A `*` that doesn’t stand for the current item resolves to nothing, as it did before
      // wildcards were supported
      return resolveFieldTag(context, fieldKeyPaths[0] ?? fieldKeyPath, source, transformations);
    }

    if (!isUuidTag(tagName)) {
      return allItems ? [] : '';
    }

    let value = uuids[uuidIndex];

    uuidIndex += 1;

    if (transformations.length) {
      value = applyTransformations({ value, transformations, locale });
    }

    return allItems ? [value] : value;
  };

  if (numeric) {
    return getNumericValue(evaluateExpression(valueTemplate, resolvePlaceholder), fieldConfig);
  }

  return replaceTemplateTags(
    valueTemplate,
    (_match, placeholder) => /** @type {string} */ (resolvePlaceholder(placeholder)),
  );
};
