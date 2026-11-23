import { getContext, setContext } from 'svelte';

/**
 * @import { DraftValueStoreKey, FieldEditorContext } from '$lib/types/private';
 */

/**
 * Key of the context a field editor provides to the editors of its subfields, and a rich text
 * editor component to the fields in it.
 */
const CONTEXT_KEY = 'field-editor';

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

/**
 * Get the context provided by the nearest field editor or rich text editor component. A field’s
 * editor rendered on its own, outside of both, gets an empty object.
 * @returns {FieldEditorContext} Context.
 */
export const getFieldEditorContext = () =>
  getContext(CONTEXT_KEY) ?? /** @type {FieldEditorContext} */ ({});

/**
 * Provide the context to the field editors below the current component.
 * @param {FieldEditorContext} context Context.
 */
export const setFieldEditorContext = (context) => {
  setContext(CONTEXT_KEY, context);
};
