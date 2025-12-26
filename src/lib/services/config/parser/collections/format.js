/**
 * @import { Field, FileExtension, FileFormat } from '$lib/types/public';
 */

/**
 * Field types that can be used for the single `body` field special case.
 * @type {string[]}
 */
const bodyFieldType = ['code', 'markdown', 'richtext'];

/**
 * Check if there is a mismatch between the file extension and format.
 * @param {FileExtension | undefined} extension File extension.
 * @param {FileFormat | undefined} format File format.
 * @param {Field[]} [fields] Fields.
 * @returns {boolean} Whether there is a mismatch between the file extension and format.
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
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

    if (name === 'body' && bodyFieldType.includes(widget)) {
      return false;
    }
  }

  // Normalize extensions (yml and yaml are interchangeable)
  const normalizedExtension = extension === 'yml' ? 'yaml' : extension;
  // Normalize formats (yml and yaml are interchangeable)
  const normalizedFormat = format === 'yml' ? 'yaml' : format;

  // For md/markdown/mdx extensions, only -frontmatter formats are valid
  if (
    normalizedExtension === 'md' ||
    normalizedExtension === 'markdown' ||
    normalizedExtension === 'mdx'
  ) {
    // Valid formats: 'frontmatter' (auto-detect) or any *-frontmatter format
    return !isFrontMatterFormat;
  }

  // Check for front-matter format mismatches with non-markdown extensions
  if (normalizedFormat.endsWith('-frontmatter')) {
    // Front-matter format: yaml-frontmatter, toml-frontmatter, json-frontmatter
    const fmFormatType = normalizedFormat.replace('-frontmatter', '');

    // Front-matter only works with matching extension
    return normalizedExtension !== fmFormatType;
  }

  // The 'frontmatter' auto-detect format only works with markdown extensions
  // (already handled above), so reject it for non-markdown extensions
  if (normalizedFormat === 'frontmatter') {
    return true;
  }

  // For known formats, ensure extension matches (yaml/toml/json)
  // For custom extensions, only validate against known formats they explicitly don’t support
  const knownFormats = ['yaml', 'toml', 'json'];

  if (knownFormats.includes(normalizedFormat)) {
    // If format is yaml/toml/json, extension should match or be custom
    return knownFormats.includes(normalizedExtension) && normalizedExtension !== normalizedFormat;
  }

  // Unknown format - don’t enforce mismatch
  return false;
};
