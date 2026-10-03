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
