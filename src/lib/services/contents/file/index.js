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
 * Template engine extensions that support any front matter format.
 * @type {string[]}
 */
export const TEMPLATE_ENGINE_EXTENSIONS = ['astro', 'njk'];

/**
 * Allowed extensions for the `frontmatter` auto-detect format.
 * @type {string[]}
 */
export const ALLOWED_FRONTMATTER_EXTENSIONS = [
  ...MARKDOWN_EXTENSIONS,
  ...TEMPLATE_ENGINE_EXTENSIONS,
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
 * List of file formats that use TOML syntax and thus require special handling, such as native date
 * objects instead of strings for date/datetime fields.
 * @type {FileFormat[]}
 */
export const TOML_FORMATS = ['toml', 'toml-frontmatter'];
