import { generateUUID } from '@sveltia/utils/crypto';
import { escapeRegExp } from '@sveltia/utils/string';

import { replaceTemplateTags } from '$lib/services/common/template';
import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';
import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';
import { getListFormatter } from '$lib/services/contents/i18n';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { ComputeField, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Regular expression to match the `fields.` prefix of a template tag, e.g. `{{fields.title}}`.
 */
const FIELD_TAG_PREFIX_REGEX = /^fields\./;

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

  let cache = generatedUuidMap.get(valueMap);

  if (!cache) {
    cache = new Map();
    generatedUuidMap.set(valueMap, cache);
  }

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
 * @returns {string | number} Computed value.
 */
export const getComputedValue = ({
  fieldConfig,
  keyPath,
  locale,
  valueMap,
  collectionName,
  fileName,
  isIndexFile = false,
}) => {
  const { value: valueTemplate = '' } = fieldConfig;

  // A lone `{{index}}` yields the number itself rather than its string representation, so that the
  // value is written to the file as a number
  if (valueTemplate === '{{index}}') {
    return getListIndex(keyPath) ?? '';
  }

  const listFormatter = getListFormatter(locale);
  const uuids = getUuids({ valueTemplate, keyPath, valueMap });
  let uuidIndex = 0;

  return replaceTemplateTags(valueTemplate, (_match, placeholder) => {
    const { value: tagName, transformations } = parseTransformations(placeholder);

    if (tagName === 'index') {
      return String(getListIndex(keyPath) ?? '');
    }

    /** @type {string} */
    let value;

    if (isUuidTag(tagName)) {
      value = uuids[uuidIndex];
      uuidIndex += 1;
    } else if (FIELD_TAG_PREFIX_REGEX.test(tagName)) {
      const fieldValue = getFieldDisplayValue({
        collectionName,
        fileName,
        valueMap,
        keyPath: tagName.replace(FIELD_TAG_PREFIX_REGEX, ''),
        locale,
        isIndexFile,
      });

      value = Array.isArray(fieldValue) ? listFormatter.format(fieldValue) : String(fieldValue);
    } else {
      return '';
    }

    if (transformations.length) {
      return applyTransformations({ value, transformations, locale });
    }

    return value;
  });
};
