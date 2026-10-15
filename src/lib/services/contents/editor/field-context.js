/**
 * @import { DraftValueStoreKey } from '$lib/types/private';
 */

/**
 * Check if a field is rendered within a rich text editor component. Its values are then stored in
 * the draft’s `extraValues` rather than `currentValues`, which is passed down to every descendant
 * field. The `fieldContext` doesn’t tell it reliably, as a List with a single subfield overrides it
 * for the subfield.
 * @param {DraftValueStoreKey | undefined} valueStoreKey Key to store the field values in the entry
 * draft, as passed to the field editor or shared through the `field-editor` context.
 * @returns {boolean} Result.
 */
export const isInEditorComponent = (valueStoreKey) => valueStoreKey === 'extraValues';
