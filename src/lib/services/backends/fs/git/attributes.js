/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

/**
 * @import { GitFileSystem, GitFilterRule } from '$lib/types/private';
 */

/**
 * Convert a `.gitattributes` pattern to a regular expression. A pattern with a slash is matched
 * against the path relative to the directory of the file, and one without against the file name at
 * any depth, like a `.gitignore` pattern.
 * @param {string} pattern Pattern.
 * @returns {RegExp} Regular expression.
 * @see https://git-scm.com/docs/gitattributes#_description
 * @see https://git-scm.com/docs/gitignore#_pattern_format
 */
export const globToRegExp = (pattern) => {
  const anchored = pattern.includes('/');
  const glob = pattern.replace(/^\//, '');
  let source = '';

  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];

    if (glob.startsWith('**/', index)) {
      source += '(?:.*/)?';
      index += 2;
    } else if (glob.startsWith('/**', index) && index + 3 === glob.length) {
      source += '/.*';
      index += 2;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '[' && glob.indexOf(']', index + 2) > 0) {
      const end = glob.indexOf(']', index + 2);

      const body = glob
        .slice(index + 1, end)
        .replace(/^!/, '^')
        .replaceAll('\\', '\\\\');

      source += `[${body}]`;
      index = end;
    } else {
      source += char.replace(/[$()+.[\\\]^{|}]/, '\\$&');
    }
  }

  return new RegExp(anchored ? `^${source}$` : `(?:^|/)${source}$`);
};

/**
 * Parse the rules in a `.gitattributes` file that set or unset the `filter` attribute, which Git
 * LFS uses with the `lfs` value.
 * @param {string} text Content of the file.
 * @returns {GitFilterRule[]} Rules.
 */
export const parseFilterRules = (text) =>
  text.split(/\r?\n/).flatMap((line) => {
    const [pattern, ...attributes] = line.trim().split(/\s+/);

    // Skip empty lines, comments, macro definitions, quoted patterns that would need unescaping,
    // and directory patterns, which never apply to the files inside
    if (!pattern || /^[#"]|^\[attr\]/.test(pattern) || pattern.endsWith('/')) {
      return [];
    }

    const attribute = attributes.findLast((attr) => /^[-!]?filter(?:=|$)/.test(attr));

    return attribute ? [{ regex: globToRegExp(pattern), lfs: attribute === 'filter=lfs' }] : [];
  });

/**
 * Find a file that’s tracked with Git LFS among the given ones, according to the `.gitattributes`
 * files in the repository and `.git/info/attributes`. Such a file has to be committed as a pointer
 * to the actual file, which only Git LFS can create.
 * @param {GitFileSystem} fs File system.
 * @param {string[]} paths File paths, relative to the repository root.
 * @returns {Promise<string | undefined>} Path of the first file tracked with Git LFS, if any.
 */
export const findLfsTrackedPath = async (fs, paths) => {
  /** @type {Map<string, Promise<GitFilterRule[]>>} */
  const cache = new Map();

  /**
   * Read the filter rules in a file, if it exists.
   * @param {string} path File path.
   * @returns {Promise<GitFilterRule[]>} Rules.
   */
  const getRules = (path) => {
    let rules = cache.get(path);

    if (!rules) {
      rules = /** @type {Promise<string>} */ (fs.readFile(path, { encoding: 'utf8' })).then(
        parseFilterRules,
        () => [],
      );
      cache.set(path, rules);
    }

    return rules;
  };

  for (const path of paths) {
    const segments = path.split('/');
    let lfs = false;

    // A file in a deeper directory takes precedence, and `.git/info/attributes` over all of them,
    // while within a file, a later line takes precedence
    const sources = [
      ...segments.map((_, depth) => {
        const dir = segments.slice(0, depth).join('/');

        return {
          file: dir ? `${dir}/.gitattributes` : '.gitattributes',
          relativePath: segments.slice(depth).join('/'),
        };
      }),
      { file: '.git/info/attributes', relativePath: path },
    ];

    for (const { file, relativePath } of sources) {
      for (const rule of await getRules(file)) {
        if (rule.regex.test(relativePath)) {
          ({ lfs } = rule);
        }
      }
    }

    if (lfs) {
      return path;
    }
  }

  return undefined;
};
