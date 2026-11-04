import { isNumeric } from '$lib/services/utils/number';

/**
 * @import {
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalEntryCollection,
 * } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Default property name used to store URL aliases, which are redirects from an entry’s previous
 * paths to its current path. Both Hugo and Zola support it out of the box.
 * @see https://gohugo.io/content-management/urls/#aliases
 * @see https://www.getzola.org/documentation/content/page/#front-matter
 */
export const DEFAULT_ALIASES_KEY = 'aliases';

/**
 * Get the name of a front matter property the CMS manages for entries in the given collection, from
 * a collection option that takes a property name or a boolean.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {Field[]} [args.fields] Field list of the collection or the collection’s index file.
 * @param {FieldKeyPath | boolean} [args.option] Option value.
 * @param {FieldKeyPath} args.defaultKey Property name to use when the option is `true`.
 * @returns {FieldKeyPath | undefined} Property name, or `undefined` if the property is not managed
 * by the CMS. That’s the case when the option is `false` or an empty string, when a field with the
 * same name is configured, or when the collection is not an entry collection.
 */
export const getManagedKey = ({ collection, fields = [], option, defaultKey }) => {
  if (collection?._type !== 'entry') {
    return undefined;
  }

  const key = option === true ? defaultKey : option || undefined;

  // A field with the same name is the user’s to manage in the entry editor, so leave the property
  // alone rather than writing to it behind their back
  if (!key || fields.some(({ name }) => name === key)) {
    return undefined;
  }

  return key;
};

/**
 * Get the property name used to store URL aliases for entries in the given collection.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {Field[]} [args.fields] Field list of the collection or the collection’s index file.
 * @returns {FieldKeyPath | undefined} Property name, which is the `aliases_field` option value if
 * defined, or `undefined` if aliases are not managed by the CMS. That’s the case when the option is
 * `false`, when a field with the same name is configured, or when the collection is not an entry
 * collection. Entries in a file or singleton collection are identified by a file name that can
 * never be changed, so they can’t be renamed or duplicated in the first place.
 */
export const getAliasesKey = ({ collection, fields }) => {
  const { aliases_field: option = DEFAULT_ALIASES_KEY } = /** @type {InternalEntryCollection} */ (
    collection ?? {}
  );

  return getManagedKey({ collection, fields, option, defaultKey: DEFAULT_ALIASES_KEY });
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
    .filter((keyPath) => keyPath.startsWith(prefix) && isNumeric(keyPath.slice(prefix.length)))
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
