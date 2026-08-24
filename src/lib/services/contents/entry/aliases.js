/**
 * @import { FlattenedEntryContent, InternalCollection } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Default property name used to store URL aliases, which are redirects from an entry’s previous
 * paths to its current path. Both Hugo and Zola support it out of the box.
 * @see https://gohugo.io/content-management/urls/#aliases
 * @see https://www.getzola.org/documentation/content/page/#front-matter
 */
export const DEFAULT_ALIASES_KEY = 'aliases';

/**
 * Get the property name used to store URL aliases for entries in the given collection.
 * @param {InternalCollection} collection Collection.
 * @returns {FieldKeyPath | undefined} Property name, which is the `aliases_field` option value if
 * defined, or `undefined` if aliases are not managed by the CMS, either because the option is
 * `false` or because the collection is not an entry collection. Entries in a file or singleton
 * collection are identified by a file name that can never be changed, so they can’t be renamed or
 * duplicated in the first place.
 */
export const getAliasesKey = (collection) => {
  if (collection?._type !== 'entry') {
    return undefined;
  }

  const { aliases_field: aliasesField = DEFAULT_ALIASES_KEY } = collection;

  if (aliasesField === true) {
    return DEFAULT_ALIASES_KEY;
  }

  // `false` and an empty string both disable the feature
  return aliasesField || undefined;
};

/**
 * Get the existing alias list item key paths in the given flattened content, sorted by index.
 * @param {FlattenedEntryContent} content Flattened entry content.
 * @param {FieldKeyPath} aliasesKey Property name used to store URL aliases.
 * @returns {string[]} Sorted key paths, such as `['aliases.0', 'aliases.1']`.
 */
export const getAliasKeyPaths = (content, aliasesKey) => {
  const prefix = `${aliasesKey}.`;

  return Object.keys(content)
    .filter((keyPath) => keyPath.startsWith(prefix) && /^\d+$/.test(keyPath.slice(prefix.length)))
    .sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)));
};

/**
 * Remove the alias property from the given flattened content. An alias must be unique across the
 * entire site, so it can never be carried over to another entry, such as a duplicate.
 * @param {FlattenedEntryContent} content Flattened entry content to be modified in place.
 * @param {FieldKeyPath | undefined} aliasesKey Property name used to store URL aliases. If it’s
 * `undefined`, nothing is removed, because the property is not managed by the CMS.
 */
export const removeAliases = (content, aliasesKey) => {
  if (!aliasesKey) {
    return;
  }

  getAliasKeyPaths(content, aliasesKey).forEach((keyPath) => {
    delete content[keyPath];
  });

  delete content[aliasesKey];
};
