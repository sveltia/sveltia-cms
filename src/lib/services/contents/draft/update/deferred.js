/**
 * Run a write to the entry draft in a microtask, outside Svelte’s update cycle.
 *
 * Field editors sync their local state to the draft from an `$effect`, and Svelte can only
 * memoize its dirty-marking traversal for writes made outside a running reaction. A write made
 * while an effect is running makes Svelte re-walk the derived graph below the value map once per
 * path that reaches it, even within `untrack()`, which is exponential in the depth of the editor
 * tree — tens of seconds per keystroke on a deeply nested entry. Deferring the write avoids that.
 *
 * As the write runs later, the callback should capture the values it needs beforehand, and check
 * that the draft is still there or that the editor is still mounted where that matters.
 * @param {() => void} write Function making the write.
 */
export const deferDraftWrite = (write) => {
  queueMicrotask(write);
};
