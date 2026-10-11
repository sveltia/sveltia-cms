import { stringify as stringifyTOML } from 'smol-toml';
import { Document, isMap, visit } from 'yaml';

import { customFileFormatRegistry } from '$lib/services/api/registries';
import { cmsConfig } from '$lib/services/config';
import { FRONTMATTER_FORMATS } from '$lib/services/contents/file/constants';
import {
  getUnsafeIntegerSource,
  hasUnsafeIntegerSources,
  restoreBigInts,
} from '$lib/services/contents/file/integers';

/**
 * @import { Scalar, ToStringOptions } from 'yaml';
 * @import { FileConfig, InternalLocaleCode } from '$lib/types/private';
 * @import {
 * FieldKeyPath,
 * JsonFormatOptions,
 * RawEntryContent,
 * YamlFormatOptions,
 * } from '$lib/types/public';
 */

/**
 * Get `JSON.rawJSON()`, which TypeScript doesn’t know yet.
 * @returns {((text: string) => any) | undefined} Function, or `undefined` in a browser without it.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/rawJSON
 */
const getRawJSON = () => /** @type {{ rawJSON?: (text: string) => any }} */ (JSON).rawJSON;

/**
 * Create a `JSON.stringify()` replacer that writes an integer read from a file, which a `number`
 * can’t represent exactly, as it was read.
 * @param {(text: string) => any} rawJSON `JSON.rawJSON()`.
 * @returns {(key: string, value: any) => any} Replacer.
 */
const createUnsafeIntegerReplacer = (rawJSON) => (_key, value) => {
  const source = getUnsafeIntegerSource(value);

  return source === undefined ? value : rawJSON(source);
};

/**
 * Format the given object as a JSON document using the built-in method.
 * @param {Record<string, any>} obj Object to be formatted.
 * @param {JsonFormatOptions} [options] Options.
 * @returns {string} Formatted document.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
 */
export const formatJSON = (obj, options = cmsConfig.current?.output?.json ?? {}) => {
  const {
    indent_style: indentStyle = 'space',
    indent_size: indentSize = indentStyle === 'tab' ? 1 : 2,
  } = options;

  const rawJSON = getRawJSON();

  return JSON.stringify(
    obj,
    // Write an integer that a `number` can’t represent exactly as it was read. A browser without
    // `JSON.rawJSON()` writes the number
    hasUnsafeIntegerSources() && rawJSON ? createUnsafeIntegerReplacer(rawJSON) : undefined,
    indentStyle === 'tab' ? '\t'.repeat(indentSize) : indentSize,
  ).trim();
};

/**
 * Format the given object as a TOML document using a library.
 * @param {Record<string, any>} obj Object to be formatted.
 * @returns {string} Formatted document.
 * @see https://github.com/squirrelchat/smol-toml
 */
export const formatTOML = (obj) =>
  // Write an integer that a `number` can’t represent exactly as it was read
  stringifyTOML(hasUnsafeIntegerSources() ? restoreBigInts(obj) : obj).trim();

/**
 * Add the given comments to the keys of a YAML map and the maps nested in it, like Netlify/Decap
 * CMS does with the `comment` field option. Items of a sequence are left alone, as the comment
 * belongs to the field rather than to each item.
 * @param {any} node YAML node.
 * @param {Record<FieldKeyPath, string>} comments Comments keyed by field key path.
 * @param {string} [prefix] Key path of the node.
 * @see https://decapcms.org/docs/configuration-options/#fields
 */
const addYAMLComments = (node, comments, prefix = '') => {
  if (!isMap(node)) {
    return;
  }

  node.items.forEach(({ key: _key, value }) => {
    // A key created from an object is always a scalar
    const key = /** @type {Scalar} */ (_key);
    const keyPath = `${prefix}${key.value}`;
    // A key named after an `Object.prototype` member, e.g. `toString`, mustn’t pick up that member
    const comment = Object.hasOwn(comments, keyPath) ? comments[keyPath] : undefined;

    if (comment) {
      // A line break can be given as a real one or, like Netlify/Decap CMS, as an escaped `\n`
      key.commentBefore = comment
        .split(/\\n|\n/)
        .map((line) => ` ${line}`)
        .join('\n');
    }

    addYAMLComments(value, comments, `${keyPath}.`);
  });
};

/**
 * Regular expression matching a string that a YAML 1.1 parser, like Psych used by Jekyll or go-yaml
 * v2 used by older Hugo releases, reads as a boolean, e.g. `yes`, `No` or `off`, the “Norway
 * problem”.
 * @see https://yaml.org/type/bool.html
 */
const YAML_1_1_BOOL_REGEX =
  /^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/;

/**
 * Regular expression matching a string that a YAML 1.1 parser reads as a number: an integer or a
 * float with underscores, a binary or octal integer, or a sexagesimal number like `1:20` (80),
 * as well as an integer or a float with commas, which Psych also accepts. A date isn’t included, as
 * it’s meant to be read as one.
 * @see https://yaml.org/type/int.html
 * @see https://yaml.org/type/float.html
 * @see https://github.com/ruby/psych/blob/master/lib/psych/scalar_scanner.rb
 */
const YAML_1_1_NUMBER_REGEX = new RegExp(
  [
    '^[-+]?(?:',
    [
      // Binary, octal and hexadecimal integers
      '0b[01_,]+',
      '0[0-7_,]+',
      '0x[\\da-fA-F_,]+',
      // Decimal integers and floats
      '(?:\\d[\\d_,]*)?\\.[\\d_,]*(?:[eE][-+]?\\d+)?',
      '\\d[\\d_,]*',
      // Sexagesimal integers and floats
      '\\d[\\d_]*(?::[0-5]?\\d)+(?:\\.[\\d_]*)?',
    ].join('|'),
    ')$',
  ].join(''),
);

/**
 * Check whether the given string would be read as something else than a string by a YAML 1.1
 * parser if written as a plain scalar. The `yaml` library follows YAML 1.2, which only quotes a
 * string that a YAML 1.2 parser would misread, like `true` or `1.5`.
 * @param {string} value String.
 * @returns {boolean} Result.
 */
export const isAmbiguousYAMLString = (value) =>
  YAML_1_1_BOOL_REGEX.test(value) || YAML_1_1_NUMBER_REGEX.test(value);

/**
 * Format the given object as a YAML document using a library.
 * @param {Record<string, any>} obj Object to be formatted.
 * @param {YamlFormatOptions} [options] Options.
 * @param {object} [legacyOptions] Deprecated collection-level options.
 * @param {boolean} [legacyOptions.quote] Quote option.
 * @param {Record<FieldKeyPath, string>} [comments] Comments to add before the keys, keyed by field
 * key path.
 * @returns {string} Formatted document.
 * @see https://eemeli.org/yaml/#tostring-options
 * @todo Remove `legacyOptions` prior to the 1.0 release.
 */
export const formatYAML = (
  obj,
  options = cmsConfig.current?.output?.yaml ?? {},
  legacyOptions = {},
  comments = {},
) => {
  const { indent_size: indent = 2, indent_sequences: indentSeq = true, quote = 'none' } = options;
  const { quote: legacyQuote = false } = legacyOptions;

  /** @type {ToStringOptions} */
  const toStringOptions = {
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
  };

  const doc = new Document(obj);

  // Quote the strings, including keys, that a YAML 1.1 parser would read as a boolean or a number,
  // which a YAML 1.2 parser doesn’t, so the `yaml` library writes them plain. Don’t use the
  // `version: '1.1'` option instead, as it would also quote dates
  visit(doc, {
    /**
     * Quote a string scalar if needed, and restore an integer that a `number` can’t represent.
     * @param {unknown} _key Key of the node in its parent.
     * @param {Scalar} node Scalar node.
     */
    Scalar: (_key, node) => {
      if (typeof node.value === 'string' && isAmbiguousYAMLString(node.value)) {
        node.type = toStringOptions.singleQuote ? 'QUOTE_SINGLE' : 'QUOTE_DOUBLE';
      }

      // Write an integer that a `number` can’t represent exactly as it was read
      const source = getUnsafeIntegerSource(node.value);

      if (source !== undefined) {
        node.value = BigInt(source);
      }
    },
  });

  addYAMLComments(doc.contents, comments);

  return doc.toString(toStringOptions).trim();
};

/**
 * Format front matter for the given entry content.
 * @param {object} args Arguments.
 * @param {RawEntryContent} args.content Entry content.
 * @param {FileConfig} args._file File configuration.
 * @param {Record<FieldKeyPath, string>} [args.comments] Comments to add before the keys, keyed by
 * field key path. YAML only.
 * @returns {string} Formatted front matter.
 * @throws {Error} When the format is not a front matter format, or the content could not be
 * formatted.
 */
export const formatFrontMatter = ({ content, _file, comments }) => {
  const {
    format,
    fmDelimiters,
    bodyField: { key: bodyKey = 'body', inline: bodyInline = false } = {},
    yamlQuote = false,
  } = _file;

  const [sd, ed] = fmDelimiters ?? ['---', '---'];
  let body = '';

  if (!bodyInline && Object.hasOwn(content, bodyKey)) {
    const value = content[bodyKey];

    // Only text can go below the front matter. Any other value, e.g. an object in a file not
    // written by the CMS, stays in the front matter rather than being thrown away; a missing value
    // is just an empty body
    if (typeof value === 'string' || value === null || value === undefined) {
      body = value ?? '';
      delete content[bodyKey];
    }
  }

  // Support Markdown without a front matter block, particularly for VitePress
  if (!Object.keys(content).length) {
    return `${body}\n`;
  }

  let head = '';

  if (format === 'frontmatter' || format === 'yaml-frontmatter') {
    head = formatYAML(content, undefined, { quote: yamlQuote }, comments);
  } else if (format === 'toml-frontmatter') {
    head = formatTOML(content);
  } else if (format === 'json-frontmatter') {
    head = formatJSON(content);

    // Like Netlify/Decap CMS, strip the outer braces of the object when they double as the
    // delimiters, so the front matter block is the object itself rather than one wrapped in
    // another pair of braces
    if (sd === '{' && ed === '}') {
      head = head.slice(1, -1).replace(/^\n/, '').replace(/\n$/, '');
    }
  } else {
    throw new Error(`Unsupported front matter format: ${format}`);
  }

  return `${sd}\n${head}\n${ed}\n${!bodyInline && body ? `\n${body}\n` : ''}`;
};

/**
 * Format raw entry content.
 * @param {object} entry File entry.
 * @param {RawEntryContent | Record<InternalLocaleCode, RawEntryContent>} entry.content Content
 * object. Note that this method may modify the `content` (the `body` property will be removed if
 * exists) so it shouldn’t be a reference to an existing object.
 * @param {FileConfig} entry._file Entry file configuration.
 * @param {Record<FieldKeyPath, string>} [entry.comments] Comments to add before the keys, keyed by
 * field key path, from the `comment` field option. YAML only, like Netlify/Decap CMS.
 * @returns {Promise<string>} Formatted string.
 * @throws {Error} When the format has no formatter, neither a custom one nor a built-in one, or the
 * content could not be formatted. Writing an empty file instead would wipe the entry’s content.
 */
export const formatEntryFile = async ({ content, _file, comments }) => {
  const { format, yamlQuote = false } = _file;
  const customFormatter = customFileFormatRegistry.get(format)?.formatter;

  if (customFormatter) {
    const output = await customFormatter(content);

    if (typeof output !== 'string') {
      throw new TypeError(
        `The \`toFile\` method registered for the custom “${format}” format must return a string`,
      );
    }

    return `${output.trim()}\n`;
  }

  if (format === 'raw') {
    return typeof content.body === 'string' ? `${content.body}\n` : '';
  }

  const isYAML = /^ya?ml$/.test(format);

  const isFrontMatter =
    format === 'frontmatter' || FRONTMATTER_FORMATS.includes(/** @type {any} */ (format));

  if (!isYAML && format !== 'toml' && format !== 'json' && !isFrontMatter) {
    throw new Error(
      customFileFormatRegistry.has(format)
        ? `Entries in the custom “${format}” format can’t be saved, as no \`toFile\` method was ` +
            'registered for it with `CMS.registerCustomFormat()`'
        : `Entries in the unknown “${format}” format can’t be saved`,
    );
  }

  try {
    if (isYAML) {
      return `${formatYAML(content, undefined, { quote: yamlQuote }, comments)}\n`;
    }

    if (format === 'toml') {
      return `${formatTOML(content)}\n`;
    }

    if (format === 'json') {
      return `${formatJSON(content)}\n`;
    }

    return formatFrontMatter({ content, _file, comments });
  } catch (/** @type {any} */ ex) {
    throw new Error(`The entry could not be formatted due to ${ex.name}: ${ex.message}`, {
      cause: ex,
    });
  }
};
