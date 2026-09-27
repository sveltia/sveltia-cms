import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * Field editor updates still in flight, e.g. a rich text editor converting what was just typed to
 * Markdown, which happens with a short delay. Until such an update lands, the entry draft holds a
 * stale value for the field, so the draft has to wait for them before it’s validated and saved.
 * @type {Set<Promise<void>>}
 */
const pendingFieldUpdates = new Set();
/**
 * Field editor updates in {@link pendingFieldUpdates} that carry a change made by the user, as
 * opposed to an editor converting a value it was given, e.g. the body of the entry being opened.
 * @type {Set<Promise<void>>}
 */
const pendingUserChanges = new Set();

/**
 * Whether a field editor update carrying a change made by the user is in flight. The entry counts
 * as changed meanwhile, so the Save button is enabled as soon as the user has made a change: a
 * change made in a rich text editor only reaches the draft a moment later, and Accel+S pressed in
 * between would find the button disabled and be ignored. An update that only converts a value the
 * editor was given doesn’t count, or the button would be enabled for a moment whenever an entry is
 * opened.
 * @type {{ current: boolean }}
 */
export const fieldUpdatePending = createRawState(false);

/**
 * Register a field editor update that hasn’t reached the entry draft yet. Registering an update
 * again, e.g. once the user has made a change while it was in flight, only updates whether it
 * carries a change made by the user.
 * @param {Promise<void>} promise Promise that settles once the draft holds the latest value.
 * @param {object} [options] Options.
 * @param {boolean} [options.userChange] Whether the update carries a change made by the user.
 */
export const trackPendingFieldUpdate = (promise, { userChange = true } = {}) => {
  if (userChange) {
    pendingUserChanges.add(promise);
    fieldUpdatePending.current = true;
  }

  if (pendingFieldUpdates.has(promise)) {
    return;
  }

  /** Remove the settled promise. A rejected update is treated like a settled one. */
  const remove = () => {
    pendingFieldUpdates.delete(promise);
    pendingUserChanges.delete(promise);
    fieldUpdatePending.current = !!pendingUserChanges.size;
  };

  pendingFieldUpdates.add(promise);
  promise.then(remove, remove);
};

/**
 * Wait for all in-flight field editor updates to reach the entry draft. Call this before validating
 * an entry for saving, so that the values being validated are the ones the user sees.
 * @returns {Promise<void>} Promise that resolves once no update is pending.
 */
export const awaitPendingFieldUpdates = async () => {
  // An update landing may trigger another one, so drain until no promises remain
  while (pendingFieldUpdates.size) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.allSettled(pendingFieldUpdates);
  }
};

/**
 * Run the given function once all in-flight field editor updates have reached the entry draft. Use
 * it to change the locale or the mode of an editor pane: the field editors in the pane are reused
 * for the new locale, so an update still in flight, e.g. a rich text editor converting what was
 * just typed, would be written to the new locale, and lost for the one it was made in.
 * @param {() => void} fn Function to run.
 */
export const afterPendingFieldUpdates = async (fn) => {
  await awaitPendingFieldUpdates();
  fn();
};
