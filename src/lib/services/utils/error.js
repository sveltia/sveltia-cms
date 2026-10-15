/**
 * Get the message of a thrown value to show the user. Anything can be thrown, not only an `Error`,
 * and a value without a working `toString()`, like an object with a `null` prototype, would make
 * plain stringification throw in turn.
 * @param {unknown} error Thrown value.
 * @returns {string} Message. Empty if there is nothing to show.
 */
export const describeError = (error) => {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return String(error ?? '');
  } catch {
    return '';
  }
};
