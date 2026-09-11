import { getContext, setContext } from 'svelte';

import { isDraftModified } from '$lib/services/contents/draft';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * Key of the Svelte context holding an {@link EntryDraftState}.
 */
const CONTEXT_KEY = 'entry-draft';
/**
 * Attribute marking an editor root element registered with {@link setEntryDraftRoot}.
 */
const ROOT_ATTRIBUTE = 'data-entry-draft-root';
/**
 * Entry draft states keyed by editor root element. See {@link setEntryDraftRoot}.
 * @type {WeakMap<Element, EntryDraftState>}
 */
const rootElementMap = new WeakMap();

/**
 * Reactive container for the entry draft open in an editor. The draft itself is a deeply reactive
 * `$state` object, so a field editor mutating its values notifies exactly the components that read
 * them; this container is what lets the draft be replaced as a whole, e.g. when another entry is
 * opened or the current one is saved.
 *
 * Each editor instance has its own container, provided to its descendants with
 * {@link setEntryDraftContext}, so more than one entry can be edited at the same time.
 */
export class EntryDraftState {
  /**
   * Current draft. `undefined` if there is no draft, e.g. the entry could not be found, or `null`
   * once the draft has been saved and the editor is about to close.
   * @type {EntryDraft | null | undefined}
   */
  current = $state.raw();

  /**
   * Whether the current draft has been modified.
   */
  modified = $derived(isDraftModified(this.current));
}

/**
 * Provide the given entry draft state to the descendant components. Called by the editor root.
 * @param {EntryDraftState} entryDraft Entry draft state.
 * @returns {EntryDraftState} The same state.
 */
export const setEntryDraftContext = (entryDraft) => setContext(CONTEXT_KEY, entryDraft);

/**
 * Get the entry draft state provided by the nearest editor root.
 * @returns {EntryDraftState} Entry draft state.
 */
export const getEntryDraftContext = () => getContext(CONTEXT_KEY);

/**
 * Register the given element as the root of an editor holding the given entry draft state, so that
 * a component rendered somewhere below it but mounted outside the Svelte component tree — a rich
 * text editor component, which Lexical mounts on its own — can still find the state through the
 * DOM with {@link getEntryDraftByElement}, as the Svelte context doesn’t reach it.
 * @param {Element} element Editor root element.
 * @param {EntryDraftState} entryDraft Entry draft state.
 */
export const setEntryDraftRoot = (element, entryDraft) => {
  element.setAttribute(ROOT_ATTRIBUTE, '');
  rootElementMap.set(element, entryDraft);
};

/**
 * Get the entry draft state of the editor the given element is rendered in.
 * @param {Element | null | undefined} element Element within an editor.
 * @returns {EntryDraftState | undefined} Entry draft state, or `undefined` if the element is not
 * within a registered editor root.
 */
export const getEntryDraftByElement = (element) => {
  const root = element?.closest(`[${ROOT_ATTRIBUTE}]`);

  return root ? rootElementMap.get(root) : undefined;
};
