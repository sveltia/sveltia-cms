import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getAliasesKey, getAliasKeyPaths } from '$lib/services/contents/entry/aliases';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import { Entry, InternalCollection, InternalEntryCollection } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * An earlier location of an entry, from before it was renamed.
 * @typedef {object} EarlierEntryPath
 * @property {string} subPath Sub path the entry had, as in its key.
 * @property {string[]} paths File paths it had, one for each locale that redirects from it.
 */

/**
 * Normalize a path on the site for a comparison: with a leading slash, and without a trailing one,
 * which an alias may or may not have.
 * @param {string} path Path.
 * @returns {string} Normalized path.
 */
const normalizeSitePath = (path) => `/${path.replace(/^\/+|\/+$/g, '')}`;

/**
 * Create a regular expression that reads the slug from an entry’s URL, from the `preview_path`
 * option: `{{slug}}` captures it, and any other tag, e.g. a date or a locale, matches a segment.
 * @param {string} template `preview_path` option.
 * @returns {RegExp | undefined} Regular expression, or `undefined` if the URL has no slug in it.
 */
const getSlugRegex = (template) => {
  const parts = normalizeSitePath(template).split(/(\{\{[^}]*\}\})/);

  if (!parts.some((part) => /^\{\{\s*slug\s*\}\}$/.test(part))) {
    return undefined;
  }

  const source = parts
    .map((part) => {
      if (/^\{\{\s*slug\s*\}\}$/.test(part)) {
        return '(?<slug>.+?)';
      }

      return part.startsWith('{{') ? '[^/]*?' : RegExp.escape(part);
    })
    .join('');

  return new RegExp(`^${source}$`);
};

/**
 * Get the locations an entry had before it was renamed outside the CMS, e.g. with `git mv`, which
 * the Git host doesn’t carry its history or comments over from. The URL aliases (redirects) the
 * entry keeps, e.g. Hugo’s `aliases`, which the CMS adds when it renames an entry, tell its earlier
 * URLs, which the `preview_path` option tells the slug in. An entry that is there again, e.g. a new
 * one with the earlier slug, is left alone, as the location is now its own.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {Field[]} [args.fields] Field list of the collection.
 * @param {Entry} args.entry Entry.
 * @returns {EarlierEntryPath[]} Earlier locations.
 */
export const getEarlierEntryPaths = ({ collection, fields, entry }) => {
  const aliasesKey = getAliasesKey({ collection, fields });
  const template = /** @type {InternalEntryCollection} */ (collection).preview_path;
  const slugRegex = aliasesKey && template ? getSlugRegex(template) : undefined;

  if (!aliasesKey || !slugRegex) {
    return [];
  }

  const { subPath, locales } = entry;
  const folder = subPath.includes('/') ? subPath.slice(0, subPath.lastIndexOf('/') + 1) : '';
  /** @type {Set<string> | undefined} */
  let existingSubPaths;

  /**
   * Check whether an entry is at the given location, listing the collection’s entries only once an
   * alias has given one, as most entries have none.
   * @param {string} earlierSubPath Sub path.
   * @returns {boolean} Result.
   */
  const isTaken = (earlierSubPath) => {
    existingSubPaths ??= new Set(getEntriesByCollection(collection.name).map((e) => e.subPath));

    return existingSubPaths.has(earlierSubPath);
  };

  /** @type {Map<string, Set<string>>} */
  const earlier = new Map();

  Object.values(locales).forEach(({ slug, path, content }) => {
    // The slug is the path without an extension, or its last segment, e.g. with folders. A slug
    // made up otherwise, e.g. translated, doesn’t tell an earlier path
    const slugIsPath = slug === subPath;

    if ((!slugIsPath && `${folder}${slug}` !== subPath) || !path.includes(subPath)) {
      return;
    }

    // A list, or a single redirect, which `jekyll-redirect-from` takes as a string too
    [
      content[aliasesKey],
      ...getAliasKeyPaths(content, aliasesKey).map((keyPath) => content[keyPath]),
    ]
      .filter(isNonEmptyString)
      .forEach((alias) => {
        const captured = slugRegex.exec(normalizeSitePath(alias))?.groups?.slug;

        // A slug with a `.` or `..` segment, or an empty one, would point outside the entry’s
        // folder, e.g. at another entry, which a stray or crafted alias mustn’t mix in
        const earlierSlug = captured?.split('/').every((segment) => !/^\.{0,2}$/.test(segment))
          ? captured
          : undefined;

        const earlierSubPath =
          earlierSlug && (slugIsPath ? earlierSlug : `${folder}${earlierSlug}`);

        if (!earlierSubPath || earlierSubPath === subPath || isTaken(earlierSubPath)) {
          return;
        }

        const paths = earlier.get(earlierSubPath) ?? new Set();
        // The sub path ends the file path, but for the extension, while a folder may share its name
        const index = path.lastIndexOf(subPath);

        paths.add(`${path.slice(0, index)}${earlierSubPath}${path.slice(index + subPath.length)}`);
        earlier.set(earlierSubPath, paths);
      });
  });

  return [...earlier].map(([earlierSubPath, paths]) => ({
    subPath: earlierSubPath,
    paths: [...paths],
  }));
};
