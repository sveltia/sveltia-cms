import { toRaw } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import { parse as libParseTOML } from 'smol-toml';
import { parse as libParseYAML } from 'yaml';

import { customFileFormatRegistry } from '$lib/services/api/registries';
import { getCollection } from '$lib/services/contents/collection';
import { isCollectionIndexFilePath } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { getFrontMatterDelimiters, resolveFileConfig } from '$lib/services/contents/file/config';
import { FRONTMATTER_FORMATS } from '$lib/services/contents/file/constants';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import {
 * BaseEntryListItem,
 * InternalCollection,
 * InternalCollectionFile,
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
 * Regular expression to match JSON front matter written by an earlier version of Sveltia CMS, which
 * wrapped a complete JSON object in the `{` and `}` delimiters, doubling the braces. The object is
 * followed by the closing delimiter on a line of its own, then by the end of the file or a blank
 * line and the body. A line break inside a JSON value is always escaped, so this can’t match
 * within the object.
 */
const DOUBLE_BRACE_JSON_FRONT_MATTER_REGEX =
  /^\{\n(?<head>\{[\s\S]*?\})\n\}(?:\n\n(?<body>[\s\S]*))?$/;

/**
 * Parse the head of JSON front matter. Like Netlify/Decap CMS, the formatter strips the outer
 * braces of the object when they double as the delimiters, so add them back if they are missing. A
 * complete object, which can come within custom delimiters, is parsed as is.
 * @param {string} head Front matter head.
 * @returns {any} Parsed object.
 */
const parseJSONFrontMatterHead = (head) => {
  const trimmedHead = head.trim();

  return parseJSON(trimmedHead.startsWith('{') ? trimmedHead : `{${trimmedHead}}`);
};

/**
 * Cache for front matter regexes, keyed by `${sd}|${ed}` (escaped delimiter pair). Avoids
 * rebuilding the same regex for every entry in a collection (all entries share identical
 * delimiters).
 * @type {Map<string, RegExp>}
 */
const frontMatterRegexCache = new Map();

/**
 * Parse front matter from a Markdown file.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {boolean} [args.isIndexFile] Whether the file is the collection’s special index file,
 * which can have a format of its own.
 * @param {FrontMatterFormat} args.format Front matter format.
 * @param {string} args.text File content.
 * @returns {Record<string, any>} Parsed front matter and body.
 * @throws {Error} When the front matter block could not be parsed.
 */
export const parseFrontMatter = ({ collection, collectionFile, isIndexFile, format, text }) => {
  const {
    format: _format,
    fmDelimiters,
    bodyField: { key: bodyKey = 'body', inline: bodyInline = false } = {},
  } = resolveFileConfig({ collection, collectionFile, isIndexFile });

  const [startDelimiter, endDelimiter] = (_format === 'frontmatter'
    ? getFrontMatterDelimiters({ format, delimiter: fmDelimiters })
    : fmDelimiters) ?? ['---', '---'];

  const sd = escapeRegExp(startDelimiter);
  const ed = escapeRegExp(endDelimiter);
  const cacheKey = `${sd}|${ed}`;

  // Front matter matching: allow an empty head, including no line at all between the delimiters
  // (e.g. Jekyll’s `---\n---`), and only match a block at the start of the file.
  const regex = getOrCreate(
    frontMatterRegexCache,
    cacheKey,
    () => new RegExp(`^${sd}\n(?:(?<head>[\\s\\S]*?)\n)?${ed}(?:\n(?<body>[\\s\\S]*))?$`, 's'),
  );

  const groups =
    (format === 'json-frontmatter' && startDelimiter === '{' && endDelimiter === '}'
      ? text.match(DOUBLE_BRACE_JSON_FRONT_MATTER_REGEX)?.groups
      : undefined) ?? text.match(regex)?.groups;

  if (!groups) {
    // Support Markdown without a front matter block, particularly for VitePress
    // The text can be an empty string, but it’s okay to return an empty body
    return { [bodyKey]: text };
  }

  const { head = '', body } = groups;
  let parsedHead = {};

  if (format === 'yaml-frontmatter') {
    parsedHead = parseYAML(head);
  }

  if (format === 'toml-frontmatter') {
    parsedHead = parseTOML(head);
  }

  if (format === 'json-frontmatter') {
    parsedHead = parseJSONFrontMatterHead(head);
  }

  if (!parsedHead || typeof parsedHead !== 'object' || Array.isArray(parsedHead)) {
    parsedHead = {};
  }

  return {
    ...parsedHead,
    // The formatter inserts a blank line between the closing delimiter and the body, so the regex
    // above leaves that blank line as a leading line break. Strip it to make the value a faithful
    // round-trip of what was written; otherwise a freshly-opened draft looks modified.
    ...(!bodyInline && !(bodyKey in parsedHead) ? { [bodyKey]: body?.replace(/^\n/, '') } : {}),
  };
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

  // The collection’s special index file can have a format of its own
  const isIndexFile = !collectionFile && isCollectionIndexFilePath(collection, path);
  let { format } = resolveFileConfig({ collection, collectionFile, isIndexFile });
  const customParser = customFileFormatRegistry.get(format)?.parser;

  if (customParser) {
    return customParser(text);
  }

  // Raw format: return the content as-is
  if (format === 'raw') {
    return { body: text };
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

    if (FRONTMATTER_FORMATS.includes(/** @type {any} */ (format))) {
      return parseFrontMatter({
        collection,
        collectionFile,
        isIndexFile,
        format: /** @type {FrontMatterFormat} */ (format),
        text,
      });
    }
  } catch (/** @type {any} */ ex) {
    throw new Error(`${path} could not be parsed due to ${ex.name}: ${ex.message}`);
  }

  if (customFileFormatRegistry.has(format)) {
    throw new Error(
      `${path} could not be parsed, as no \`fromFile\` method was registered for the custom ` +
        `“${format}” format with \`CMS.registerCustomFormat()\``,
    );
  }

  throw new Error(`${path} could not be parsed due to an unknown format: ${format}`);
};
