/**
 * @import { Entry, FlattenedEntryContent, LocalizedEntry } from '$lib/types/private';
 */

/**
 * Function returning the new content of a locale. The content of the entry it’s given is shared
 * with the store, so it has to return a copy rather than change it.
 * @callback EntryContentGetter
 * @param {{ locale: string, localizedEntry: LocalizedEntry }} args Arguments.
 * @returns {FlattenedEntryContent} New content.
 */

/**
 * Replace the content of every locale of an entry that has content. A locale that was disabled only
 * carries the path of its file, and is left as is.
 * @param {Entry} entry Entry.
 * @param {EntryContentGetter} getContent Function returning the new content.
 * @returns {Entry} Copy of the entry with the new content.
 */
export const mapEntryContent = (entry, getContent) => ({
  ...entry,
  locales: Object.fromEntries(
    Object.entries(entry.locales).map(([locale, localizedEntry]) => [
      locale,
      localizedEntry.content
        ? { ...localizedEntry, content: getContent({ locale, localizedEntry }) }
        : localizedEntry,
    ]),
  ),
});
