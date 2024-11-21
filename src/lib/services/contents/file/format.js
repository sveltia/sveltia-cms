import * as TOML from 'smol-toml';
import { get } from 'svelte/store';
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
  const customFormatter = get(customFileFormats)[format]?.formatter;

  if (customFormatter) {
    return `${(await customFormatter(content)).trim()}\n`;
  }

  try {
    if (format.match(/^ya?ml$/)) {
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

  if (format.match(/^(?:(?:yaml|toml|json)-)?frontmatter$/)) {
    const [startDelimiter, endDelimiter] = fmDelimiters ?? ['---', '---'];
    const body = content.body ? `${content.body}\n` : '';

    delete content.body;

    try {
      if (format === 'frontmatter' || format === 'yaml-frontmatter') {
        return `${startDelimiter}\n${formatYAML(content, { yamlQuote })}\n${endDelimiter}\n${body}`;
      }

      if (format === 'toml-frontmatter') {
        return `${startDelimiter}\n${formatTOML(content)}\n${endDelimiter}\n${body}`;
      }

      if (format === 'json-frontmatter') {
        return `${startDelimiter}\n${formatJSON(content)}\n${endDelimiter}\n${body}`;
      }
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  }

  return '';
};
