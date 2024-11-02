import { toRaw } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import * as TOML from 'smol-toml';
import { get } from 'svelte/store';
import YAML from 'yaml';
import { customFileFormats, getFrontMatterDelimiters } from '$lib/services/contents/file';

/**
 * Parse a JSON document using the built-in method.
 * @param {string} str - JSON document.
 * @returns {any} Parsed object.
 */
const parseJSON = (str) => JSON.parse(str);
/**
 * Parse a TOML document using a library. The TOML parser returns date fields as `Date` objects, but
 * we need strings to match the JSON and YAML parsers, so we have to parse twice.
 * @param {string} str - TOML document.
 * @returns {any} Parsed object.
 */
const parseTOML = (str) => toRaw(TOML.parse(str));
/**
 * Parse a YAML document using a library.
 * @param {string} str - YAML document.
 * @returns {any} Parsed object.
 */
const parseYAML = (str) => YAML.parse(str);

/**
 * Determine the Markdown front matter serialization format by checking a delimiter in the content.
 * @param {string} text - File content.
 * @returns {FrontMatterFormat | undefined} One of the formats or `undefined` if undetermined.
 */
const detectFrontMatterFormat = (text) => {
  if (text.startsWith('---')) {
    return 'yaml-frontmatter';
  }

  if (text.startsWith('+++')) {
    return 'toml-frontmatter';
  }

  if (text.startsWith('{')) {
    return 'json-frontmatter';
  }

  return undefined;
};

/**
 * Parse raw content with given file details.
 * @param {BaseEntryListItem} entry - Entry file list item.
 * @returns {any} Parsed content.
 * @throws {Error} When the content could not be parsed.
 */
export const parseEntryFile = ({
  text = '',
  path,
  folder: {
    filePathMap,
    parserConfig: { extension, format, frontmatterDelimiter },
  },
}) => {
  text = text.trim();

  format ||= /** @type {FileFormat | undefined} */ (
    ['md', 'markdown'].includes(extension ?? '') || path.match(/\.(?:md|markdown)$/)
      ? detectFrontMatterFormat(text)
      : extension || Object.values(filePathMap ?? {})[0]?.match(/\.([^.]+)$/)?.[1]
  );

  if (format === 'frontmatter') {
    format = detectFrontMatterFormat(text);
  }

  // Ignore files with unknown format
  if (!format) {
    throw new Error(`${path} could not be parsed due to an unknown format`);
  }

  const customParser = get(customFileFormats)[format]?.parser;

  if (customParser) {
    return customParser(text);
  }

  try {
    if (format.match(/^ya?ml$/)) {
      return parseYAML(text);
    }

    if (format === 'toml') {
      return parseTOML(text);
    }

    if (format === 'json') {
      return parseJSON(text);
    }

    if (format.match(/^(?:yaml|toml|json)-frontmatter$/)) {
      const [startDelimiter, endDelimiter] = getFrontMatterDelimiters(format, frontmatterDelimiter);

      const [, head, body = ''] =
        text.match(
          new RegExp(
            `^${escapeRegExp(startDelimiter)}\\n(.+?)\\n${escapeRegExp(endDelimiter)}(?:\\n(.+))?`,
            'ms',
          ),
        ) ?? [];

      if (!head) {
        throw new Error('No front matter block found');
      }

      if (format === 'yaml-frontmatter') {
        return { ...parseYAML(head), body };
      }

      if (format === 'toml-frontmatter') {
        return { ...parseTOML(head), body };
      }

      if (format === 'json-frontmatter') {
        return { ...parseJSON(head), body };
      }
    }
  } catch (/** @type {any} */ ex) {
    throw new Error(`${path} could not be parsed due to ${ex.name}: ${ex.message}`);
  }

  throw new Error(`${path} could not be parsed due to an unknown format: ${format}`);
};
