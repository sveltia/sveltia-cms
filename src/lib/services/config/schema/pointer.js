/**
 * Decode the escape sequences of a JSON pointer segment.
 * @param {string} segment Segment to decode.
 * @returns {string} Decoded segment.
 */
export const decodeSegment = (segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~');

/**
 * Split a JSON pointer, or a URI fragment holding one, into decoded segments.
 * @param {string} pointer Pointer, such as `#/properties/backend/$ref/properties/name/const`.
 * @returns {string[]} Segments.
 */
export const getSegments = (pointer) =>
  pointer.replace(/^#/, '').split('/').filter(Boolean).map(decodeSegment);

/**
 * Get the value a JSON pointer, or a URI fragment holding one, points to.
 * @param {any} root Document the pointer is resolved against.
 * @param {string} pointer Pointer.
 * @returns {any} Value, or `undefined` if the pointer can’t be resolved.
 */
export const resolvePointer = (root, pointer) =>
  getSegments(pointer).reduce((/** @type {any} */ value, key) => value?.[key], root);
