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

/**
 * Percent-encode a string as RFC 3986 requires. Unlike `encodeURIComponent()`, the characters
 * `!'()*` are encoded as well: they are reserved as sub-delimiters, and they affect the Markdown
 * syntax of images and links, while Signature Version 4 of AWS requires every character other
 * than the unreserved ones to be encoded.
 * @param {string} str String to encode.
 * @returns {string} Encoded string.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#encoding_for_rfc3986
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
 */
export const encodeRFC3986 = (str) =>
  encodeURIComponent(str).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * Percent-encode a slash-separated value, such as a file path, an object key, a route path or a Git
 * branch name, segment by segment, keeping the slashes. `encodeURI()` would leave `#` and `?` as
 * they are, which end a URL path, so a value containing them would be cut short — a branch name
 * like `cms/posts/c#` would become `cms/posts/c`, for example — and a `%` sign in a file name
 * wouldn’t be decoded back to the same name.
 * @param {string} path Value to encode, e.g. `/assets/images/50%off.jpg`.
 * @param {(segment: string) => string} [encodeSegment] Function to encode each segment. Default:
 * `encodeURIComponent`.
 * @returns {string} Encoded value, e.g. `/assets/images/50%25off.jpg`.
 */
export const encodePathSegments = (path, encodeSegment = encodeURIComponent) =>
  path
    .split('/')
    .map((segment) => encodeSegment(segment))
    .join('/');

/**
 * Remove any trailing slashes from the given URL or path, so another segment can be appended after
 * a single slash. Unlike `stripSlashes()` from `@sveltia/utils/string`, a leading slash is kept.
 * @param {string} url URL or path, e.g. `https://example.com/media/`.
 * @returns {string} Trimmed URL or path, e.g. `https://example.com/media`.
 */
export const trimTrailingSlashes = (url) => url.replace(/\/+$/, '');
