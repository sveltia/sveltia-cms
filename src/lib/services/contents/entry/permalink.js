import { getManagedKey } from '$lib/services/contents/entry/aliases';

/**
 * @import { InternalCollection, InternalEntryCollection } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Property name used to store an entry’s permalink when the `permalink_field` option is `true`.
 * It’s what Eleventy reads to decide where to build a page.
 * @see https://www.11ty.dev/docs/permalinks/
 */
export const DEFAULT_PERMALINK_KEY = 'permalink';

/**
 * Get the property name used to store the permalink of entries in the given collection.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {Field[]} [args.fields] Field list of the collection or the collection’s index file.
 * @returns {FieldKeyPath | undefined} Property name, or `undefined` if permalinks are not managed
 * by the CMS, which is the default as the property means something else to other generators.
 */
export const getPermalinkKey = ({ collection, fields }) =>
  getManagedKey({
    collection,
    fields,
    option: /** @type {InternalEntryCollection} */ (collection)?.permalink_field,
    defaultKey: DEFAULT_PERMALINK_KEY,
  });
