/**
 * @import { FileExtension, FileFormat } from '$lib/types/public';
 */

/**
 * Check if there is a mismatch between the file extension and format.
 * @param {FileExtension | undefined} extension File extension.
 * @param {FileFormat | undefined} format File format.
 * @returns {boolean} Whether there is a mismatch between the file extension and format.
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 */
export const isFormatMismatch = (extension, format) => {
  // If either is undefined, there’s no mismatch
  if (!extension || !format) {
    return false;
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
    return !(normalizedFormat === 'frontmatter' || normalizedFormat.endsWith('-frontmatter'));
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
