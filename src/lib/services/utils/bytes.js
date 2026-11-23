/**
 * Shared UTF-8 encoder.
 */
export const textEncoder = new TextEncoder();

/**
 * Shared UTF-8 decoder.
 */
export const textDecoder = new TextDecoder();

/**
 * Compare two byte arrays.
 * @param {Uint8Array} a One.
 * @param {Uint8Array} b The other.
 * @returns {number} A negative number if `a` comes first, a positive number if `b` comes first, or
 * zero if they’re equal.
 */
export const compareBytes = (a, b) => {
  const length = Math.min(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }

  return a.length - b.length;
};

/**
 * Concatenate byte arrays into one.
 * @param {Uint8Array[]} parts Byte arrays.
 * @returns {Uint8Array} Joined bytes.
 */
export const concatBytes = (parts) => {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;

  parts.forEach((part) => {
    bytes.set(part, position);
    position += part.length;
  });

  return bytes;
};
