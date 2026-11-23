/**
 * @import { FileExtension, FileFormat, FrontMatterFormat } from '$lib/types/public';
 */

/**
 * Markdown file extensions that support front matter formats.
 * @type {string[]}
 */
export const MARKDOWN_EXTENSIONS = [
  'markdown',
  'md',
  'mdown',
  'mdwn',
  'mdx',
  'mkd',
  'mkdn',
  'html.md',
];

/**
 * Map of supported file formats to their default extensions.
 * @type {Record<string, FileExtension>}
 */
export const FORMAT_EXTENSION_MAP = {
  raw: 'txt',
  yaml: 'yml',
  yml: 'yml',
  toml: 'toml',
  json: 'json',
};

/**
 * Map of file extensions to their corresponding file formats for auto-detection.
 * @type {Record<string, FileFormat>}
 */
export const EXTENSION_FORMAT_MAP = {
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  json: 'json',
  // Astro files default to the `raw` format, which allows editing the entire file content directly.
  // The front matter in Astro is not YAML but JavaScript, so we cannot use the `yaml-frontmatter`
  // format. The `raw` format is the best fit for Astro files.
  astro: 'raw',
};

/**
 * Map of front matter formats to their default delimiters.
 * @type {Record<string, [string, string]>}
 */
export const FRONTMATTER_DELIMITER_MAP = {
  'json-frontmatter': ['{', '}'],
  'toml-frontmatter': ['+++', '+++'],
  'yaml-frontmatter': ['---', '---'],
};

/**
 * File formats that use front matter syntax, excluding the `frontmatter` auto-detect format.
 * @type {FrontMatterFormat[]}
 */
export const FRONTMATTER_FORMATS = ['yaml-frontmatter', 'toml-frontmatter', 'json-frontmatter'];

/**
 * File formats that come with a built-in parser and formatter. A custom format registered under one
 * of these names can leave out either method and fall back to the built-in one.
 * @type {FileFormat[]}
 */
export const BUILTIN_FILE_FORMATS = [
  'yml',
  'yaml',
  'toml',
  'json',
  'frontmatter',
  ...FRONTMATTER_FORMATS,
  'raw',
];

/**
 * List of file formats that use TOML syntax and thus require special handling, such as native date
 * objects instead of strings for date/datetime fields.
 * @type {FileFormat[]}
 */
export const TOML_FORMATS = ['toml', 'toml-frontmatter'];

/**
 * Syntax of a file format: YAML, TOML or JSON.
 * @typedef {'yaml' | 'toml' | 'json'} FormatSyntax
 */

/**
 * Map of the built-in file formats, other than `raw`, to the syntax of the file, or of its front
 * matter block. A new file in the `frontmatter` format gets YAML front matter.
 * @type {Record<string, FormatSyntax>}
 */
const FORMAT_SYNTAX_MAP = {
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  json: 'json',
  frontmatter: 'yaml',
  'yaml-frontmatter': 'yaml',
  'toml-frontmatter': 'toml',
  'json-frontmatter': 'json',
};

/**
 * Get the syntax of the given file format: that of the whole file, or of its front matter block.
 * @param {string} format File format.
 * @returns {FormatSyntax | undefined} Syntax, or `undefined` for the `raw` format or a format
 * without a built-in parser and formatter.
 */
export const getFormatSyntax = (format) =>
  Object.hasOwn(FORMAT_SYNTAX_MAP, format) ? FORMAT_SYNTAX_MAP[format] : undefined;
