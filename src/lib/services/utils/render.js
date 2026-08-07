import { flushSync } from 'svelte';

/**
 * Whether a {@link flushSync} call is already queued for the current microtask checkpoint.
 */
let flushQueued = false;

/**
 * Run the queued {@link flushSync}, allowing a new one to be queued afterwards.
 */
const runQueuedFlush = () => {
  flushQueued = false;
  flushSync();
};

/**
 * Request a synchronous flush of pending Svelte effects, coalescing repeated requests made within
 * the same microtask checkpoint into a single {@link flushSync} call.
 *
 * `flushSync()` re-renders the whole component tree, so calling it from a component that appears
 * many times on a page — an asset thumbnail in a grid, say — costs O(n) full renders when the
 * instances settle together. Queuing the call collapses that into one, while still flushing before
 * the browser paints.
 */
export const requestFlushSync = () => {
  if (flushQueued) {
    return;
  }

  flushQueued = true;
  queueMicrotask(runQueuedFlush);
};
