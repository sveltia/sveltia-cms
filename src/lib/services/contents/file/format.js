import * as TOML from 'smol-toml';
import YAML from 'yaml';
import { customFileFormats } from '$lib/services/contents/file';

/**
 * Format the given object as a JSON document using the built-in method.
 * @param {any} obj - Object to be formatted.
 * @returns {string} Formatted document.
 */
const formatJSON = (obj) => JSON.stringify(obj, null, 2).trim();
/**
 * Format the given object as a TOML document using a library.
 * @param {any} obj - Object to be formatted.
 * @returns {string} Formatted document.
 */
const formatTOML = (obj) => TOML.stringify(obj).trim();

/**
 * Format the given object as a YAML document using a library.
 * @param {any} obj - Object to be formatted.
 * @param {object} [options] - Options.
 * @param {boolean} [options.yamlQuote] - Quote option.
 * @returns {string} Formatted document.
 */
const formatYAML = (obj, { yamlQuote = false } = {}) =>
  YAML.stringify(obj, null, {
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: yamlQuote ? 'QUOTE_DOUBLE' : 'PLAIN',
  }).trim();

/**
 * Format raw entry content.
 * @param {object} entry - File entry.
 * @param {RawEntryContent | Record<LocaleCode, RawEntryContent>} entry.content - Content object.
 * Note that this method may modify the `content` (the `body` property will be removed if exists) so
 * it shouldn’t be a reference to an existing object.
 * @param {FileConfig} entry._file - Entry file configuration.
 * @returns {Promise<string>} Formatted string.
 */
export const formatEntryFile = async ({ content, _file }) => {
  const { format, fmDelimiters, yamlQuote = false } = _file;
  const customFormatter = customFileFormats[format]?.formatter;

  if (customFormatter) {
    return `${(await customFormatter(content)).trim()}\n`;
  }

  try {
    if (/^ya?ml$/.test(format)) {
      return `${formatYAML(content, { yamlQuote })}\n`;
    }

    if (format === 'toml') {
      return `${formatTOML(content)}\n`;
    }

    if (format === 'json') {
      return `${formatJSON(content)}\n`;
    }
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return '';
  }

  if (/^(?:(?:yaml|toml|json)-)?frontmatter$/.test(format)) {
    const [sd, ed] = fmDelimiters ?? ['---', '---'];
    const body = typeof content.body === 'string' ? content.body : '';

    delete content.body;

    // Support Markdown without a front matter block, particularly for VitePress
    if (!Object.keys(content).length) {
      return `${body}\n`;
    }

    try {
      if (format === 'frontmatter' || format === 'yaml-frontmatter') {
        return `${sd}\n${formatYAML(content, { yamlQuote })}\n${ed}\n${body}\n`;
      }

      if (format === 'toml-frontmatter') {
        return `${sd}\n${formatTOML(content)}\n${ed}\n${body}\n`;
      }

      if (format === 'json-frontmatter') {
        return `${sd}\n${formatJSON(content)}\n${ed}\n${body}\n`;
      }
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  }

  return '';
};
