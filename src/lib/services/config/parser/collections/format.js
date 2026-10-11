import { EXTENSION_FORMAT_MAP, MARKDOWN_EXTENSIONS } from '$lib/services/contents/file/constants';

/**
 * @import { Field, FileExtension, FileFormat } from '$lib/types/public';
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

  // Raw format never mismatches
  if (format === 'raw') {
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
