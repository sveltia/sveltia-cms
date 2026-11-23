/**
 * @import { InternalCollection } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

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
