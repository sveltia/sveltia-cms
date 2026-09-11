/**
 * Field editor updates still in flight, e.g. a rich text editor converting what was just typed to
 * Markdown, which happens with a short delay. Until such an update lands, the entry draft holds a
 * stale value for the field, so the draft has to wait for them before it’s validated and saved.
 * @type {Set<Promise<void>>}
 */
const pendingFieldUpdates = new Set();

/**
 * Register a field editor update that hasn’t reached the entry draft yet.
 * @param {Promise<void>} promise Promise that settles once the draft holds the latest value.
 */
export const trackPendingFieldUpdate = (promise) => {
  /** Remove the settled promise. A rejected update is treated like a settled one. */
  const remove = () => {
    pendingFieldUpdates.delete(promise);
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
    await Promise.allSettled([...pendingFieldUpdates]);
  }
};
