import { stringify as stringifyTOML } from 'smol-toml';
import { get } from 'svelte/store';
import { stringify as stringifyYAML } from 'yaml';

import { cmsConfig } from '$lib/services/config';
import { customFileFormatRegistry } from '$lib/services/contents/file/config';

/**
 * @import { FileConfig, InternalLocaleCode, RawEntryContent } from '$lib/types/private';
 * @import { JsonFormatOptions, YamlFormatOptions } from '$lib/types/public';
 */

/**
 * Format the given object as a JSON document using the built-in method.
 * @param {Record<string, any>} obj Object to be formatted.
 * @param {JsonFormatOptions} [options] Options.
 * @returns {string} Formatted document.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
 */
export const formatJSON = (obj, options = get(cmsConfig)?.output?.json ?? {}) => {
  const {
    indent_style: indentStyle = 'space',
    indent_size: indentSize = indentStyle === 'tab' ? 1 : 2,
  } = options;

  return JSON.stringify(
    obj,
    null,
    indentStyle === 'tab' ? '\t'.repeat(indentSize) : indentSize,
  ).trim();
};

/**
 * Format the given object as a TOML document using a library.
 * @param {Record<string, any>} obj Object to be formatted.
 * @returns {string} Formatted document.
 * @see https://github.com/squirrelchat/smol-toml
 */
export const formatTOML = (obj) => stringifyTOML(obj).trim();

/**
 * Format the given object as a YAML document using a library.
 * @param {Record<string, any>} obj Object to be formatted.
 * @param {YamlFormatOptions} [options] Options.
 * @param {object} [legacyOptions] Deprecated collection-level options.
 * @param {boolean} [legacyOptions.quote] Quote option.
 * @returns {string} Formatted document.
 * @see https://eemeli.org/yaml/#tostring-options
 * @todo Remove `legacyOptions` prior to the 1.0 release.
 */
export const formatYAML = (
  obj,
  options = get(cmsConfig)?.output?.yaml ?? {},
  legacyOptions = {},
) => {
  const { indent_size: indent = 2, indent_sequences: indentSeq = true, quote = 'none' } = options;
  const { quote: legacyQuote = false } = legacyOptions;

  return stringifyYAML(obj, null, {
    indent,
    indentSeq,
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType:
      legacyQuote || quote === 'double'
        ? 'QUOTE_DOUBLE'
        : quote === 'single'
          ? 'QUOTE_SINGLE'
          : 'PLAIN',
    singleQuote: !(legacyQuote || quote === 'double'),
  }).trim();
};

/**
 * Format front matter for the given entry content.
 * @param {object} args Arguments.
 * @param {RawEntryContent} args.content Entry content.
 * @param {FileConfig} args._file File configuration.
 * @returns {string} Formatted front matter.
 */
export const formatFrontMatter = ({ content, _file }) => {
  const { format, fmDelimiters, yamlQuote = false } = _file;
  const [sd, ed] = fmDelimiters ?? ['---', '---'];
  const body = typeof content.body === 'string' ? content.body : '';

  delete content.body;

  // Support Markdown without a front matter block, particularly for VitePress
  if (!Object.keys(content).length) {
    return `${body}\n`;
  }

  try {
    if (format === 'frontmatter' || format === 'yaml-frontmatter') {
      return `${sd}\n${formatYAML(content, undefined, { quote: yamlQuote })}\n${ed}\n${body}\n`;
    }

    if (format === 'toml-frontmatter') {
      return `${sd}\n${formatTOML(content)}\n${ed}\n${body}\n`;
    }

    if (format === 'json-frontmatter') {
      return `${sd}\n${formatJSON(content)}\n${ed}\n${body}\n`;
    }
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
  }

  return '';
};

/**
 * Format raw entry content.
 * @param {object} entry File entry.
 * @param {RawEntryContent | Record<InternalLocaleCode, RawEntryContent>} entry.content Content
 * object. Note that this method may modify the `content` (the `body` property will be removed if
 * exists) so it shouldn’t be a reference to an existing object.
 * @param {FileConfig} entry._file Entry file configuration.
 * @returns {Promise<string>} Formatted string.
 */
export const formatEntryFile = async ({ content, _file }) => {
  const { format, yamlQuote = false } = _file;
  const customFormatter = customFileFormatRegistry.get(format)?.formatter;

  if (customFormatter) {
    return `${(await customFormatter(content)).trim()}\n`;
  }

  if (format === 'raw') {
    return typeof content.body === 'string' ? `${content.body}\n` : '';
  }

  try {
    if (/^ya?ml$/.test(format)) {
      return `${formatYAML(content, undefined, { quote: yamlQuote })}\n`;
    }

    if (format === 'toml') {
      return `${formatTOML(content)}\n`;
    }

    if (format === 'json') {
      return `${formatJSON(content)}\n`;
    }
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return '';
  }

  if (/^(?:(?:yaml|toml|json)-)?frontmatter$/.test(format)) {
    return formatFrontMatter({ content, _file });
  }

  return '';
};
