/**
 * Decode the given string with the given decoder. A malformed escape sequence, e.g. the `%` sign in
 * a `50%off.jpg` file name, would make the decoder throw, so in that case only the valid escape
 * sequences are decoded and anything else is left as is.
 * @param {string} str Encoded string.
 * @param {(str: string) => string} decoder `decodeURI` or `decodeURIComponent`.
 * @returns {string} Decoded string.
 */
const decodeSafely = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[\da-f]{2})+/gi, (sequence) => {
      try {
        return decoder(sequence);
      } catch {
        return sequence;
      }
    });
  }
};

/**
 * Decode the given URI or path like `decodeURI()`, but without throwing on a malformed escape
 * sequence, e.g. the `%` sign in `/images/50%off.jpg`, which is left as is.
 * @param {string} uri Encoded URI or path.
 * @returns {string} Decoded URI or path.
 */
export const decodeURISafely = (uri) => decodeSafely(uri, decodeURI);

/**
 * Decode the given URI component like `decodeURIComponent()`, but without throwing on a malformed
 * escape sequence, e.g. the `%` sign in `50%off.jpg`, which is left as is.
 * @param {string} component Encoded URI component.
 * @returns {string} Decoded URI component.
 */
export const decodeURIComponentSafely = (component) => decodeSafely(component, decodeURIComponent);
