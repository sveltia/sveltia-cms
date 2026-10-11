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

/**
 * Encode the given URL for an `href` or `src` attribute. Unlike `encodeURI()`, an escape sequence
 * already in the URL is kept as is rather than encoded again, so that `https://example.com/caf%C3%A9`
 * doesn’t become `https://example.com/caf%25C3%25A9`. A URL that can’t be parsed is decoded first,
 * then encoded with `encodeURI()`.
 * @param {string} url URL, e.g. `https://example.com/café` or `mailto:alice@example.com`.
 * @returns {string} Encoded URL.
 */
export const encodeURLSafely = (url) => {
  try {
    return new URL(url).href;
  } catch {
    // A lone surrogate would make `encodeURI()` throw
    return encodeURI(decodeURISafely(url).toWellFormed());
  }
};
