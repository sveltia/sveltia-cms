import { getContext, setContext } from 'svelte';

/**
 * @import { Entry, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Entry of a bulk editor row, which the field controls in the row read in place of an entry draft
 * through `getEditorEntryValues()`, e.g. to resolve the `{{slug}}` and `{{fields.x}}` templates in
 * the filters of a Relation field.
 * @typedef {object} BulkEditRowContext
 * @property {FlattenedEntryContent} values Values of the entry in the default locale, with the
 * pending edits applied.
 * @property {string} slug Slug of the entry in the default locale.
 */

/**
 * Key of the context a bulk editor cell provides to its field control.
 */
const CONTEXT_KEY = 'bulk-edit-row';

/**
 * Get the context provided by a bulk editor cell.
 * @returns {BulkEditRowContext | undefined} Context, or `undefined` outside of the bulk editor.
 */
export const getBulkEditRowContext = () => getContext(CONTEXT_KEY);

/**
 * Provide the context to the field control of a bulk editor cell.
 * @param {BulkEditRowContext} context Context. Use getters to keep the values reactive.
 */
export const setBulkEditRowContext = (context) => {
  setContext(CONTEXT_KEY, context);
};

/**
 * Get the values of an entry as they are shown in a bulk editor row: the stored content in the
 * given locale with the pending edits of the entry applied. An edited list value replaces the
 * stored items, which are flattened into `name.0`, `name.1` and so on.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry.
 * @param {InternalLocaleCode} args.locale Locale, which is the collection’s default locale.
 * @param {Record<FieldKeyPath, any> | undefined} args.edits Pending edits of the entry, keyed by
 * field name.
 * @returns {FlattenedEntryContent} Values.
 */
export const getBulkEditRowValues = ({ entry, locale, edits }) => {
  /** @type {FlattenedEntryContent} */
  const values = { ...entry.locales[locale]?.content };

  Object.entries(edits ?? {}).forEach(([keyPath, value]) => {
    Object.keys(values).forEach((key) => {
      if (key.startsWith(`${keyPath}.`)) {
        delete values[key];
      }
    });

    values[keyPath] = value;
  });

  return values;
};

/**
 * Get the slug of an entry in a locale, falling back to its canonical slug.
 * @param {Entry} entry Entry.
 * @param {InternalLocaleCode} locale Locale.
 * @returns {string} Slug.
 */
export const getBulkEditRowSlug = (entry, locale) => entry.locales[locale]?.slug ?? entry.slug;
