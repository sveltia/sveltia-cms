import { toRaw } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import { parse as libParseTOML } from 'smol-toml';
import { parse as libParseYAML, parseDocument } from 'yaml';

import { customFileFormatRegistry } from '$lib/services/api/registries';
import { getCollection } from '$lib/services/contents/collection';
import { isCollectionIndexFilePath } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { getFrontMatterDelimiters, resolveFileConfig } from '$lib/services/contents/file/config';
import {
  FRONTMATTER_DELIMITER_MAP,
  FRONTMATTER_FORMATS,
  getFormatSyntax,
} from '$lib/services/contents/file/constants';
import { detectedFrontMatterFormats } from '$lib/services/contents/file/detected-formats';
import {
  mayHaveUnsafeInteger,
  replaceBigInts,
  reviveUnsafeInteger,
} from '$lib/services/contents/file/integers';
import { rememberTomlValueSources } from '$lib/services/contents/file/toml-sources';
import {
  collectJSONFloatSources,
  collectYAMLFloatSources,
  mayHaveWholeNumberFloat,
  rememberValueSources,
  reviveWholeNumberFloat,
  valueSources,
} from '$lib/services/contents/file/value-sources';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import {
 * BaseEntryListItem,
 * InternalCollection,
 * InternalCollectionFile,
 * } from '$lib/types/private';
 * @import { FormatSyntax } from '$lib/services/contents/file/constants';
 * @import { FileFormat, FrontMatterFormat } from '$lib/types/public';
 */

/**
 * A `JSON.parse()` reviver combining {@link reviveUnsafeInteger} and
 * {@link reviveWholeNumberFloat}.
 * @param {string} key Property name.
 * @param {any} value Parsed value.
 * @param {{ source?: string }} [context] Context, which holds the source text of a primitive value.
 * @returns {any} Value.
 */
const reviveNumber = (key, value, context) =>
  reviveWholeNumberFloat(key, reviveUnsafeInteger(key, value, context), context);

/**
 * Parse a JSON document using the built-in method. An integer that a `number` can’t represent
 * exactly is remembered, so it can be saved as it was. So is the source text of a float that is a
 * whole number, e.g. `10.0`, if the document is read from a file.
 * @param {string} str JSON document.
 * @param {string} [path] Path of the file the document is read from.
 * @returns {any} Parsed object.
 * @see {@link reviveUnsafeInteger}
 * @see {@link reviveWholeNumberFloat}
 */
export const parseJSON = (str, path) => {
  if (path === undefined || !mayHaveWholeNumberFloat(str)) {
    return mayHaveUnsafeInteger(str) ? JSON.parse(str, reviveUnsafeInteger) : JSON.parse(str);
  }

  const { value, sourceMap } = collectJSONFloatSources(JSON.parse(str, reviveNumber));

  rememberValueSources(path, sourceMap);

  return value;
};

/**
 * Parse a TOML document using a library. The TOML parser returns date fields as `Date` objects, but
 * we need strings to match the JSON and YAML parsers, so we have to parse twice. An integer that a
 * `number` can’t represent exactly, which the parser would otherwise reject, is remembered, so it
 * can be saved as it was. So is the source text of a date, and of a float that is a whole number,
 * e.g. `10.0`, if the document is read from a file.
 * @param {string} str TOML document.
 * @param {string} [path] Path of the file the document is read from.
 * @returns {any} Parsed object.
 * @see {@link replaceBigInts}
 * @see {@link rememberTomlValueSources}
 */
export const parseTOML = (str, path) => {
  const parsed = replaceBigInts(libParseTOML(str, { integersAsBigInt: 'asNeeded' }));

  if (path !== undefined) {
    rememberTomlValueSources({ path, str, parsed });
  }

  return toRaw(parsed);
};

/**
 * Parse a YAML document using a library, like its `parse()` method, and remember the source text of
 * the floats in it that are whole numbers.
 * @param {string} str YAML document.
 * @param {Record<string, any> | undefined} options Parsing options.
 * @param {string} path Path of the file the document is read from.
 * @returns {any} Parsed object.
 * @throws {Error} When the document could not be parsed.
 * @see https://github.com/eemeli/yaml/blob/main/src/public-api.ts
 */
const parseYAMLWithFloatSources = (str, options, path) => {
  const doc = parseDocument(str, options);

  // eslint-disable-next-line no-console
  doc.warnings.forEach((warning) => console.warn(warning));

  if (doc.errors.length) {
    throw doc.errors[0];
  }

  rememberValueSources(path, collectYAMLFloatSources(doc));

  return doc.toJS(options);
};

/**
 * Parse a YAML document using a library. An integer that a `number` can’t represent exactly is
 * remembered, so it can be saved as it was. So is the source text of a float that is a whole
 * number, e.g. `10.0`, if the document is read from a file.
 * @param {string} str YAML document.
 * @param {object} [options] Parsing options.
 * @param {string} [path] Path of the file the document is read from.
 * @returns {any} Parsed object.
 * @see {@link replaceBigInts}
 * @see {@link collectYAMLFloatSources}
 */
export const parseYAML = (str, options, path) => {
  const hasUnsafeInteger = mayHaveUnsafeInteger(str);
  const _options = hasUnsafeInteger ? { ...options, intAsBigInt: true } : options;

  const parsed =
    path !== undefined && mayHaveWholeNumberFloat(str)
      ? parseYAMLWithFloatSources(str, _options, path)
      : libParseYAML(str, _options);

  return hasUnsafeInteger ? replaceBigInts(parsed) : parsed;
};

/**
 * Detect the Markdown front matter serialization format by checking a delimiter in the content.
 * @param {string} text File content.
 * @returns {FrontMatterFormat} Determined format.
 */
export const detectFrontMatterFormat = (text) =>
  FRONTMATTER_FORMATS.find((format) => text.startsWith(FRONTMATTER_DELIMITER_MAP[format][0])) ??
  'yaml-frontmatter';

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
 * @param {string} [path] Path of the file the front matter is read from.
 * @returns {any} Parsed object.
 */
const parseJSONFrontMatterHead = (head, path) => {
  const trimmedHead = head.trim();

  return parseJSON(trimmedHead.startsWith('{') ? trimmedHead : `{${trimmedHead}}`, path);
};

/**
 * Parser for each syntax, taking a document and the path of the file it’s read from.
 * @type {Record<FormatSyntax, (str: string, path?: string) => any>}
 */
const PARSERS = {
  /**
   * Parse the given YAML document.
   * @param {string} str Document.
   * @param {string} [path] Path of the file the document is read from.
   * @returns {any} Parsed object.
   */
  yaml: (str, path) => parseYAML(str, undefined, path),
  toml: parseTOML,
  json: parseJSON,
};

/**
 * Parser for the head of front matter in each syntax.
 * @type {Record<FormatSyntax, (head: string, path?: string) => any>}
 */
const FRONT_MATTER_PARSERS = { ...PARSERS, json: parseJSONFrontMatterHead };
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
 * @param {string} [args.path] File path, given to remember the source text of the floats that are
 * whole numbers.
 * @returns {Record<string, any>} Parsed front matter and body.
 * @throws {Error} When the front matter block could not be parsed.
 */
export const parseFrontMatter = ({
  collection,
  collectionFile,
  isIndexFile,
  format,
  text,
  path,
}) => {
  const {
    format: _format,
    fmDelimiters,
    bodyField: { key: bodyKey = 'body', inline: bodyInline = false } = {},
  } = resolveFileConfig({ collection, collectionFile, isIndexFile });

  const [startDelimiter, endDelimiter] =
    (_format === 'frontmatter'
      ? getFrontMatterDelimiters({ format, delimiter: fmDelimiters })
      : fmDelimiters) ?? FRONTMATTER_DELIMITER_MAP['yaml-frontmatter'];

  const sd = escapeRegExp(startDelimiter);
  const ed = escapeRegExp(endDelimiter);
  const cacheKey = `${sd}|${ed}`;

  // Front matter matching: allow an empty head, including no line at all between the delimiters
  // (e.g. Jekyll’s `---\n---`), and only match a block at the start of the file. Trailing spaces or
  // tabs after a delimiter are ignored, as other front matter parsers do.
  const regex = getOrCreate(
    frontMatterRegexCache,
    cacheKey,
    () =>
      new RegExp(
        `^${sd}[ \t]*\n(?:(?<head>[\\s\\S]*?)\n)?${ed}[ \t]*(?:\n(?<body>[\\s\\S]*))?$`,
        's',
      ),
  );

  // Blank lines or spaces before the front matter block are ignored
  const trimmedText = text.trimStart();

  const groups =
    (format === 'json-frontmatter' && startDelimiter === '{' && endDelimiter === '}'
      ? trimmedText.match(DOUBLE_BRACE_JSON_FRONT_MATTER_REGEX)?.groups
      : undefined) ?? trimmedText.match(regex)?.groups;

  if (!groups) {
    // Support Markdown without a front matter block, particularly for VitePress. The body keeps its
    // leading whitespace, e.g. an indented code block. The text can be an empty string, but it’s
    // okay to return an empty body
    return { [bodyKey]: text };
  }

  const { head = '', body } = groups;
  const syntax = FRONTMATTER_FORMATS.includes(format) ? getFormatSyntax(format) : undefined;
  let parsedHead = syntax ? FRONT_MATTER_PARSERS[syntax](head, path) : {};

  if (!parsedHead || typeof parsedHead !== 'object' || Array.isArray(parsedHead)) {
    parsedHead = {};
  }

  return {
    ...parsedHead,
    // The formatter inserts a blank line between the closing delimiter and the body, so the regex
    // above leaves that blank line as a leading line break. Strip it to make the value a faithful
    // round-trip of what was written; otherwise a freshly-opened draft looks modified. The front
    // matter takes precedence over the text below it. With `body_field.inline` on, text below is
    // still read when the front matter lacks the key, so it’s moved inline on a Save rather than
    // lost, but no empty body is added to a file that has none.
    ...(!Object.hasOwn(parsedHead, bodyKey) && (!bodyInline || body?.trim())
      ? { [bodyKey]: body?.replace(/^\n/, '') }
      : {}),
  };
};

/**
 * Resolve the collection, collection file and format of the given entry file.
 * @param {Pick<BaseEntryListItem, 'path' | 'folder'>} file Entry file list item.
 * @returns {{ collection: InternalCollection, collectionFile: InternalCollectionFile | undefined,
 * isIndexFile: boolean, format: FileFormat }} Collection, collection file, whether the file is the
 * collection’s special index file, and the format.
 * @throws {Error} When the collection or the collection file can’t be found.
 */
const resolveEntryFile = ({ path, folder: { collectionName, fileName } }) => {
  const collection = getCollection(collectionName);

  const collectionFile =
    collection && fileName ? getCollectionFile(collection, fileName) : undefined;

  if (!collection) {
    throw new Error('Collection not found');
  }

  if (fileName && !collectionFile) {
    throw new Error('Collection file not found');
  }

  // The collection’s special index file can have a format of its own
  const isIndexFile = !collectionFile && isCollectionIndexFilePath(collection, path);
  const { format } = resolveFileConfig({ collection, collectionFile, isIndexFile });

  return { collection, collectionFile, isIndexFile, format };
};

/**
 * Check whether the given entry file is read with a parser registered with
 * `CMS.registerCustomFormat()`. What such a parser returns can change from one load to the next
 * without the configuration changing, so its results are never cached.
 * @param {Pick<BaseEntryListItem, 'path' | 'folder'>} file Entry file list item.
 * @returns {boolean} Result. `false` if the file’s collection can’t be found, as it’s then not
 * parsed at all.
 */
export const hasCustomParser = (file) => {
  try {
    return !!customFileFormatRegistry.get(resolveEntryFile(file).format)?.parser;
  } catch {
    return false;
  }
};

/**
 * Parse raw content with given file details.
 * @param {BaseEntryListItem} entry Entry file list item.
 * @returns {Promise<any>} Parsed content.
 * @throws {Error} When the content could not be parsed.
 */
export const parseEntryFile = async ({ text = '', path, folder }) => {
  const resolved = resolveEntryFile({ path, folder });
  const { collection, collectionFile, isIndexFile } = resolved;
  let { format } = resolved;

  // Forget what was read from an earlier version of the file
  valueSources.delete(path);

  // Normalize line breaks. The leading whitespace is only dropped where it’s meaningless: the
  // content of a raw file, and the body of a file without front matter, keep theirs, e.g. an
  // indented code block at the start of a Markdown file, as a save keeps it
  text = text.trimEnd().replace(/\r\n?/g, '\n');

  const trimmedText = text.trimStart();
  const customParser = customFileFormatRegistry.get(format)?.parser;

  if (customParser) {
    return customParser(trimmedText);
  }

  // Raw format: return the content as-is
  if (format === 'raw') {
    return { body: text };
  }

  try {
    if (format === 'frontmatter') {
      const detectedFormat = detectFrontMatterFormat(trimmedText);

      // Remembered, so the file is saved back in the same format
      detectedFrontMatterFormats.set(path, detectedFormat);
      format = detectedFormat;
    }

    if (FRONTMATTER_FORMATS.includes(/** @type {any} */ (format))) {
      return parseFrontMatter({
        collection,
        collectionFile,
        isIndexFile,
        format: /** @type {FrontMatterFormat} */ (format),
        text,
        path,
      });
    }

    // Any other format with a syntax is read as a whole
    const syntax = getFormatSyntax(format);

    if (syntax) {
      return PARSERS[syntax](trimmedText, path);
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
