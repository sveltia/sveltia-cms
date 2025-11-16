import { toRaw } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import { parse as libParseTOML } from 'smol-toml';
import { parse as libParseYAML } from 'yaml';

import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import {
  customFileFormatRegistry,
  getFrontMatterDelimiters,
} from '$lib/services/contents/file/config';

/**
 * @import {
 * BaseEntryListItem,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalEntryCollection,
 * } from '$lib/types/private';
 * @import { FrontMatterFormat } from '$lib/types/public';
 */

/**
 * Parse a JSON document using the built-in method.
 * @param {string} str JSON document.
 * @returns {any} Parsed object.
 */
export const parseJSON = (str) => JSON.parse(str);

/**
 * Parse a TOML document using a library. The TOML parser returns date fields as `Date` objects, but
 * we need strings to match the JSON and YAML parsers, so we have to parse twice.
 * @param {string} str TOML document.
 * @returns {any} Parsed object.
 */
export const parseTOML = (str) => toRaw(libParseTOML(str));

/**
 * Parse a YAML document using a library.
 * @param {string} str YAML document.
 * @param {object} [options] Parsing options.
 * @returns {any} Parsed object.
 */
export const parseYAML = (str, options) => libParseYAML(str, options);

/**
 * Detect the Markdown front matter serialization format by checking a delimiter in the content.
 * @param {string} text File content.
 * @returns {FrontMatterFormat} Determined format.
 */
export const detectFrontMatterFormat = (text) => {
  if (text.startsWith('+++')) {
    return 'toml-frontmatter';
  }

  if (text.startsWith('{')) {
    return 'json-frontmatter';
  }

  return 'yaml-frontmatter';
};

/**
 * Parse front matter from a Markdown file.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {FrontMatterFormat} args.format Front matter format.
 * @param {string} args.text File content.
 * @returns {Record<string, any>} Parsed front matter and body.
 * @throws {Error} When the front matter block could not be parsed.
 */
export const parseFrontMatter = ({ collection, collectionFile, format, text }) => {
  const {
    _file: { format: _format, fmDelimiters },
  } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const [startDelimiter, endDelimiter] = (_format === 'frontmatter'
    ? getFrontMatterDelimiters({ format, delimiter: fmDelimiters })
    : fmDelimiters) ?? ['---', '---'];

  const sd = escapeRegExp(startDelimiter);
  const ed = escapeRegExp(endDelimiter);
  // Front matter matching: allow an empty head
  const regex = new RegExp(`^${sd}\\n(?:(?<head>.*?)\\n)?${ed}$(?:\\n(?<body>.+))?`, 'ms');
  const { head, body } = text.match(regex)?.groups ?? {};

  if (!head && !body) {
    // Support Markdown without a front matter block, particularly for VitePress
    // The text can be an empty string, but it’s okay to return an empty body
    return { body: text };
  }

  let parsedHead = {};

  if (format === 'yaml-frontmatter') {
    parsedHead = parseYAML(head);
  }

  if (format === 'toml-frontmatter') {
    parsedHead = parseTOML(head);
  }

  if (format === 'json-frontmatter') {
    // For JSON front matter, we need to add the braces back since the regex strips them
    parsedHead = parseJSON(`{${head}}`);
  }

  return { ...parsedHead, body };
};

/**
 * Parse raw content with given file details.
 * @param {BaseEntryListItem} entry Entry file list item.
 * @returns {Promise<any>} Parsed content.
 * @throws {Error} When the content could not be parsed.
 */
export const parseEntryFile = async ({ text = '', path, folder: { collectionName, fileName } }) => {
  const collection = getCollection(collectionName);

  const collectionFile =
    collection && fileName ? getCollectionFile(collection, fileName) : undefined;

  if (!collection) {
    throw new Error('Collection not found');
  }

  if (fileName && !collectionFile) {
    throw new Error('Collection file not found');
  }

  // Normalize line breaks
  text = text.trim().replace(/\r\n?/g, '\n');

  let {
    _file: { format },
  } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const customParser = customFileFormatRegistry.get(format)?.parser;

  if (customParser) {
    return customParser(text);
  }

  try {
    if (format === 'yaml' || format === 'yml') {
      return parseYAML(text);
    }

    if (format === 'toml') {
      return parseTOML(text);
    }

    if (format === 'json') {
      return parseJSON(text);
    }

    if (format === 'frontmatter') {
      format = detectFrontMatterFormat(text);
    }

    if (/^(?:yaml|toml|json)-frontmatter$/.test(format)) {
      return parseFrontMatter({ collection, collectionFile, format, text });
    }
  } catch (/** @type {any} */ ex) {
    throw new Error(`${path} could not be parsed due to ${ex.name}: ${ex.message}`);
  }

  throw new Error(`${path} could not be parsed due to an unknown format: ${format}`);
};
