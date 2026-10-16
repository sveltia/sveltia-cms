import { generateUUID } from '@sveltia/utils/crypto';
import { escapeRegExp } from '@sveltia/utils/string';

import { FIELD_TAG_PREFIX_REGEX } from '$lib/services/common/template/constants';
import { processNestedTemplates } from '$lib/services/common/template/nested';
import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';
import { getField } from '$lib/services/contents/entry/fields';
import { getFieldDisplayValue } from '$lib/services/contents/entry/values';
import { evaluateExpression } from '$lib/services/contents/fields/compute/expression';
import {
  getNumberFormatter,
  isFloatType,
  isStringOutput,
} from '$lib/services/contents/fields/number/helpers';
import { getListFormatter } from '$lib/services/contents/i18n';
import { getOrCreate } from '$lib/services/utils/cache';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { ComputeField, FieldKeyPath, LocaleCode, NumberField } from '$lib/types/public';
 */

/**
 * Length argument of {@link generateUUID} for each UUID tag, keyed by tag name.
 * @type {Record<string, 'short' | 'shorter' | undefined>}
 */
const UUID_TAG_LENGTHS = {
  uuid: undefined,
  uuid_short: 'short',
  uuid_shorter: 'shorter',
};

/**
 * Regular expression source matching the value each UUID tag generates, keyed by tag name.
 * @type {Record<string, string>}
 */
const UUID_TAG_PATTERNS = {
  uuid: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
  uuid_short: '[0-9a-f]{12}',
  uuid_shorter: '[0-9a-f]{8}',
};

/**
 * Placeholder standing in for a template tag while the template’s literal text is escaped for a
 * regular expression. It can’t appear in a template.
 */
const TAG_PLACEHOLDER = '\0';
/**
 * UUIDs generated for the Compute fields of a locale’s content, keyed by the content and then by
 * the field’s key path, in the order of the UUID tags in the template. The content maps live as
 * long as the draft does, so a value is generated once per draft; see {@link getUuids}.
 * @type {WeakMap<FlattenedEntryContent, Map<FieldKeyPath, string[]>>}
 */
const generatedUuidMap = new WeakMap();

/**
 * Get the list index found in the given key path, which is the second-to-last segment, e.g. `2` for
 * `authors.2.slug`.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @returns {number | undefined} Index, or `undefined` if the field is not in a list item.
 * @see https://github.com/sveltia/sveltia-cms/issues/172
 */
export const getListIndex = (keyPath) => {
  const [index] = keyPath.split('.').splice(-2, 1);

  return index && isNumeric(index) ? Number(index) : undefined;
};

/**
 * Check whether the given template tag is a UUID tag.
 * @param {string} tagName Tag name.
 * @returns {boolean} Result.
 */
const isUuidTag = (tagName) => Object.hasOwn(UUID_TAG_PATTERNS, tagName);

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
  /** @type {string[]} */
  const tagNames = [];

  const literals = replaceTemplateTags(valueTemplate, (_match, placeholder) => {
    tagNames.push(parseTransformations(placeholder).value);

    return TAG_PLACEHOLDER;
  })
    .split(TAG_PLACEHOLDER)
    .map(escapeRegExp);

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
      .map((tagName, i) => `${literals[start + i]}(${UUID_TAG_PATTERNS[tagName]})`)
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
    generatedUuids = uuidTags.map(({ tagName }) => generateUUID(UUID_TAG_LENGTHS[tagName]));
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
 * Check whether the given Compute field yields a number, which is the case when its `value_type`
 * option is anything but `string`. Its `value` is then an arithmetic expression.
 * @param {ComputeField} fieldConfig Field configuration.
 * @returns {boolean} Result.
 */
export const isNumericComputeField = ({ value_type: valueType = 'string' }) =>
  valueType !== 'string';

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
  const numberFieldConfig = /** @type {NumberField} */ (/** @type {unknown} */ (fieldConfig));
  const stringOutput = isStringOutput(numberFieldConfig);
  const integer = !isFloatType(numberFieldConfig);

  // Adding zero turns `-0` into `0`
  const number =
    result === undefined
      ? undefined
      : (integer || Number.isInteger(result)
          ? Math.round(result)
          : Number(result.toPrecision(15))) + 0;

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

  return isNumericComputeField(fieldConfig) && string.trim() && Number.isFinite(number)
    ? getNumberFormatter(canonicalLocale).format(number)
    : string;
};

/**
 * Where a `{{fields.*}}` tag of a Compute field is resolved: the content and the rich text editor
 * component, if any, the key path refers to.
 * @typedef {object} FieldTagSource
 * @property {FlattenedEntryContent} valueMap Content holding the field value.
 * @property {string} [componentName] Name of the component whose field the key path refers to.
 */

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
  const numeric = isNumericComputeField(fieldConfig);

  // A lone `{{index}}` yields the number itself rather than its string representation, so that the
  // value is written to the file as a number. A numeric `value_type` decides the type itself
  if (!numeric && valueTemplate === '{{index}}') {
    return getListIndex(keyPath) ?? '';
  }

  const listFormatter = getListFormatter(locale);
  // A UUID can’t be an operand of an arithmetic expression, and the configuration parser reports
  // one used there, so none is generated
  const uuids = numeric ? [] : getUuids({ valueTemplate, keyPath, valueMap });
  const componentName = keyPathPrefix ? valueMap[`${keyPathPrefix}__sc_component_name`] : undefined;
  /** @type {FlattenedEntryContent | undefined} */
  let componentValues;
  let uuidIndex = 0;

  /**
   * Get the content and the component the given key path refers to.
   * @param {FieldKeyPath} fieldKeyPath Key path from a `{{fields.*}}` tag.
   * @returns {FieldTagSource} Source.
   */
  const getFieldTagSource = (fieldKeyPath) => {
    if (!keyPathPrefix) {
      return { valueMap };
    }

    const getFieldArgs = { collectionName, fileName, isIndexFile, keyPath: fieldKeyPath };

    if (componentName && getField({ ...getFieldArgs, componentName })) {
      componentValues ??= getComponentValues(valueMap, keyPathPrefix);

      return { valueMap: componentValues, componentName };
    }

    return { valueMap: entryValueMap };
  };

  /**
   * Resolve a template tag of the value template.
   * @param {string} placeholder Tag content, e.g. `fields.title | upper`.
   * @returns {string} Resolved value.
   */
  const resolvePlaceholder = (placeholder) => {
    const { value: tagName, transformations: parsedTransformations } =
      parseTransformations(placeholder);

    if (tagName === 'index') {
      return String(getListIndex(keyPath) ?? '');
    }

    // Resolve the tags in the transformation arguments like the tag itself, e.g. `{{fields.title}}`
    // in `default('{{fields.title}}')`. A UUID tag there resolves to nothing, as the UUIDs are
    // counted only in the template itself and one there would shift the others
    const transformations = processNestedTemplates(parsedTransformations, (innerTag) =>
      isUuidTag(parseTransformations(innerTag).value) ? '' : resolvePlaceholder(innerTag),
    );

    /** @type {string} */
    let value;

    if (isUuidTag(tagName)) {
      value = uuids[uuidIndex];
      uuidIndex += 1;
    } else if (FIELD_TAG_PREFIX_REGEX.test(tagName)) {
      const fieldKeyPath = stripFieldTagPrefix(tagName);

      const { valueMap: sourceValueMap, componentName: sourceComponentName } =
        getFieldTagSource(fieldKeyPath);

      const getFieldArgs = {
        collectionName,
        fileName,
        componentName: sourceComponentName,
        valueMap: sourceValueMap,
        keyPath: fieldKeyPath,
        isIndexFile,
      };

      // Let `getFieldDisplayValue()` apply the transformations, so they get the raw value and the
      // field configuration: a boolean for `ternary` rather than `'false'`, which is truthy, and
      // the stored date for `date` rather than the localized display value. A value missing from
      // the content, like that of a List field, which is stored under its item key paths, or an
      // unset field, would come back empty whatever the transformations, breaking `default`, so
      // the transformations are applied to its display value instead.
      const rawValue = sourceValueMap[fieldKeyPath];
      const hasRawValue = rawValue !== undefined;

      // A number is inserted as stored rather than formatted for display, so a template like
      // `/p/{{fields.sku}}` doesn’t give `/p/123,456`, and an arithmetic expression can use it.
      // That includes the value of a Compute field that yields a number
      if (hasRawValue) {
        const sourceFieldConfig = getField(getFieldArgs);

        if (
          sourceFieldConfig?.widget === 'number' ||
          (sourceFieldConfig?.widget === 'compute' &&
            isNumericComputeField(/** @type {ComputeField} */ (sourceFieldConfig)))
        ) {
          // The transformations get a string as they would get the display value, so `0` isn’t
          // taken as empty by `default`
          value = String(rawValue ?? '');

          return transformations.length
            ? applyTransformations({
                fieldConfig: sourceFieldConfig,
                value,
                transformations,
                locale,
              })
            : value;
        }
      }

      const fieldValue = getFieldDisplayValue({
        ...getFieldArgs,
        locale,
        transformations: hasRawValue ? transformations : undefined,
      });

      value = Array.isArray(fieldValue) ? listFormatter.format(fieldValue) : String(fieldValue);

      if (hasRawValue) {
        return value;
      }
    } else {
      return '';
    }

    if (transformations.length) {
      return applyTransformations({ value, transformations, locale });
    }

    return value;
  };

  if (numeric) {
    return getNumericValue(evaluateExpression(valueTemplate, resolvePlaceholder), fieldConfig);
  }

  return replaceTemplateTags(valueTemplate, (_match, placeholder) =>
    resolvePlaceholder(placeholder),
  );
};
