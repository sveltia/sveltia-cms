/**
 * Keep a promise that is awaited later from being reported as an unhandled rejection in the
 * meantime. The rejection is still delivered to whoever awaits the promise.
 * @template T
 * @param {Promise<T>} promise Promise.
 * @returns {Promise<T>} The same promise.
 */
export const deferRejection = (promise) => {
  promise.catch(() => {
    // Handled where the promise is awaited
  });

  return promise;
};
