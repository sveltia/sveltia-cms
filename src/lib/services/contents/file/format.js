import { stringify as stringifyTOML } from 'smol-toml';
import { Document, isMap } from 'yaml';

import { customFileFormatRegistry } from '$lib/services/api/registries';
import { cmsConfig } from '$lib/services/config';
import { FRONTMATTER_FORMATS } from '$lib/services/contents/file/constants';

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
    const comment = comments[keyPath];

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

  if (!bodyInline && bodyKey in content) {
    body = typeof content[bodyKey] === 'string' ? content[bodyKey] : '';
    delete content[bodyKey];
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
