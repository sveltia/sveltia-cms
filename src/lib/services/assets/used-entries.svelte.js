import { watchAsync } from '$lib/services/utils/state.svelte';

/**
 * @import { Entry } from '$lib/types/private';
 */

/**
 * Keep track of the entries using some files, for a dialog that tells how many entries a change
 * will update, or refuses the change because one of them can’t be updated. The entries are looked
 * up again whenever the files change, and are `undefined` until found, so a dialog can wait for
 * them before it opens; a slow lookup for files picked earlier never overwrites the entries of the
 * ones picked now. Call it while a component is being initialized.
 * @param {() => Promise<Entry[]> | undefined} find Function looking up the entries using the
 * current files, or returning `undefined` while there are none.
 * @param {(entries: Entry[]) => void} [onFound] Function called once the entries have been found.
 * @returns {{ readonly entries: Entry[] | undefined }} Entries, or `undefined` while being looked
 * up or without files.
 */
export const createUsedEntriesState = (find, onFound) => {
  /** @type {Entry[] | undefined} */
  let entries = $state.raw();

  watchAsync(
    () => {
      entries = undefined;

      return find();
    },
    (result) => {
      entries = result;
      onFound?.(result);
    },
  );

  return {
    /**
     * Get the entries.
     * @returns {Entry[] | undefined} Entries, or `undefined` while being looked up.
     */
    get entries() {
      return entries;
    },
  };
};
