/**
 * Encode the data carried by a magic link, used to sign in with a mobile device, to a string that
 * can be put in the URL hash. The data is serialized to JSON, encoded as UTF-8, so that it can hold
 * any character, e.g. in a password or a deploy hook URL stored in the preferences, and then
 * encoded with the URL-safe Base64 alphabet. Unlike the standard alphabet, it has no `/`, which
 * the router would take for a path separator, and trim if it came last.
 * @param {any} data Data to encode.
 * @returns {string} Encoded data.
 */
export const encodeMagicLinkData = (data) =>
  new TextEncoder()
    .encode(JSON.stringify(data))
    .toBase64({ alphabet: 'base64url', omitPadding: true });

/**
 * Decode the data carried by a magic link, encoded with {@link encodeMagicLinkData}. Links made by
 * earlier versions of the app, which used `btoa()` and the standard Base64 alphabet, are also
 * accepted: their text was Latin-1, so a byte sequence that is not valid UTF-8 is read as Latin-1
 * like `atob()` does. ASCII text, which is all such a link usually holds, is the same either way;
 * only Latin-1 text that happens to be valid UTF-8 as well, such as `Ã©`, would read differently.
 * @param {string} encodedData Encoded data.
 * @returns {any} Decoded data.
 * @throws {Error} If the data is not valid Base64 or JSON.
 */
export const decodeMagicLinkData = (encodedData) => {
  const bytes = Uint8Array.fromBase64(encodedData.replaceAll('+', '-').replaceAll('/', '_'), {
    alphabet: 'base64url',
  });

  let text;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Not `TextDecoder('latin1')`, which is actually windows-1252 and maps `0x80`–`0x9F` otherwise
    text = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  }

  return JSON.parse(text);
};
