import { customFileFormatRegistry } from '$lib/services/api/registries';
import { addMessage } from '$lib/services/config/parser/utils/validator';
import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { detectFileExtension, detectFileFormat } from '$lib/services/contents/file/config';
import { EXTENSION_FORMAT_MAP, MARKDOWN_EXTENSIONS } from '$lib/services/contents/file/constants';

/**
 * @import {
 * BodyFieldOptions,
 * Field,
 * FileExtension,
 * FileFormat,
 * NumberField,
 * } from '$lib/types/public';
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 */

/**
 * Field types that can be used for the single `body` field special case.
 * @type {string[]}
 */
const BODY_FIELD_TYPES = ['code', 'markdown', 'richtext', 'text'];
/**
 * Known file formats.
 * @type {FileFormat[]}
 */
const KNOWN_FORMATS = ['yaml', 'toml', 'json'];

/**
 * Check if there is a mismatch between the file extension and format.
 * @param {FileExtension | undefined} extension File extension.
 * @param {FileFormat | undefined} format File format.
 * @param {Field[]} [fields] Fields.
 * @returns {boolean} Whether there is a mismatch between the file extension and format.
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 * @see https://sveltiacms.app/en/docs/collections/entries/formats
 */
export const isFormatMismatch = (extension, format, fields = []) => {
  // If either is undefined, there’s no mismatch
  if (!extension || !format) {
    return false;
  }

  // Raw format never mismatches, and neither does a custom format registered with
  // `CMS.registerCustomFormat()`, which can take any extension, including `md`. Custom formats are
  // registered before the configuration is parsed
  if (format === 'raw' || customFileFormatRegistry.has(format)) {
    return false;
  }

  const isFrontMatterFormat = format.endsWith('-frontmatter') || format === 'frontmatter';

  // Special case: single `body` code or rich text field in a front-matter format. Treat as no
  // mismatch to allow editing the raw file content directly, e.g. .json, .yaml, .toml files.
  if (isFrontMatterFormat && fields.length === 1) {
    const [{ name, widget = 'string' }] = fields;

    if (name === 'body' && BODY_FIELD_TYPES.includes(widget)) {
      return false;
    }
  }

  // Normalize extensions (yml and yaml are interchangeable)
  const normalizedExtension = extension === 'yml' ? 'yaml' : extension;
  // Normalize formats (yml and yaml are interchangeable)
  const normalizedFormat = format === 'yml' ? 'yaml' : format;

  // For md/markdown/mdx extensions, only -frontmatter formats are valid
  if (MARKDOWN_EXTENSIONS.includes(normalizedExtension)) {
    // Valid formats: 'frontmatter' (auto-detect) or any *-frontmatter format
    return !isFrontMatterFormat;
  }

  // Any other extension, such as `html` or `njk`, works with every front-matter format, like in
  // Decap CMS, where the `format` option takes precedence over the extension. The exceptions are
  // the data file extensions (`yaml`, `toml`, `json`), which only work with the matching
  // front-matter format, if any, and `astro`, whose front matter is JavaScript, not YAML
  if (isFrontMatterFormat) {
    const extensionFormat = EXTENSION_FORMAT_MAP[normalizedExtension];

    return (
      extensionFormat !== undefined &&
      extensionFormat !== normalizedFormat.replace('-frontmatter', '')
    );
  }

  // For known formats, ensure extension matches (yaml/toml/json)
  // For custom extensions, only validate against known formats they explicitly don’t support
  if (KNOWN_FORMATS.includes(normalizedFormat)) {
    // If format is yaml/toml/json, extension should match or be custom
    return KNOWN_FORMATS.includes(normalizedExtension) && normalizedExtension !== normalizedFormat;
  }

  // Unknown format - don’t enforce mismatch
  return false;
};

/**
 * Field types whose value is never text, so it can’t be stored as the body below the front matter.
 */
const NON_TEXT_FIELD_TYPES = ['boolean', 'keyvalue', 'list', 'number', 'object'];

/**
 * Check whether the given field holds something other than text: an object, an array, a number or
 * a boolean.
 * @param {Field} field Field configuration.
 * @returns {boolean} Result.
 */
const isNonTextField = (field) => {
  const { widget = 'string' } = field;

  // A Number field with a `*/string` value type stores what the user typed as a string
  if (widget === 'number') {
    // prettier-ignore
    return !(/** @type {NumberField} */ (field).value_type ?? '').endsWith('/string');
  }

  return NON_TEXT_FIELD_TYPES.includes(widget) || isFieldMultiple(field);
};

/**
 * Check that the field storing the body below the front matter, `body` by default, holds text. Only
 * a string can be written there, so any other value would be lost on save.
 * @param {object} args Arguments.
 * @param {FileExtension} [args.extension] Developer-defined file extension.
 * @param {FileFormat} [args.format] Developer-defined file format.
 * @param {BodyFieldOptions} [args.bodyField] Developer-defined `body_field` option.
 * @param {Field[]} [args.fields] Fields of the collection or collection file.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkBodyField = ({ extension, format, bodyField, fields, context, collectors }) => {
  const { key = 'body', inline = false } = bodyField ?? {};
  const field = Array.isArray(fields) ? fields.find(({ name }) => name === key) : undefined;

  // The type of the options is checked against the JSON schema
  if (inline || !field || typeof key !== 'string') {
    return;
  }

  const _format = detectFileFormat({
    extension: detectFileExtension({ extension, format }),
    format,
  });

  if ((_format === 'frontmatter' || _format.endsWith('-frontmatter')) && isNonTextField(field)) {
    addMessage({
      strKey: 'front_matter_body_field_not_text',
      // A field without the `widget` option is a String field, which holds text
      values: { name: key, widget: /** @type {string} */ (field.widget) },
      context: { ...context, typedKeyPath: key },
      collectors,
    });
  }
};
