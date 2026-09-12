/**
 * Encode the given bytes as a lowercase hexadecimal string.
 * @param {ArrayBuffer | Uint8Array} bytes Bytes to encode.
 * @returns {string} Hex string.
 */
export const toHex = (bytes) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Create an HMAC-SHA256 signature.
 * @param {string | Uint8Array} key Secret key.
 * @param {string} data Data to sign.
 * @returns {Promise<Uint8Array>} Raw signature bytes.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign
 */
export const hmacSha256 = async (key, data) => {
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    /** @type {BufferSource} */ (typeof key === 'string' ? encoder.encode(key) : key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));

  return new Uint8Array(signature);
};
