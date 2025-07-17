/**
 * Remove some inline Markdown syntax from the given string. This covers bold, italic, strikethrough
 * and code. This function does not remove single characters like the `_` prefix in `_redirects`.
 * @param {string} str Original string.
 * @returns {string} Modified string.
 */
export const removeMarkdownSyntax = (str) => {
  let result = str;
  let changed = true;

  // Keep processing until no more changes are made to handle nested cases
  while (changed) {
    const before = result;

    // Process from innermost to outermost by trying single character patterns first
    result = result.replaceAll(/([_*`~])([^_*`~]+)\1/g, '$2');

    // Then handle multi-character patterns (like ** or __ or ~~)
    result = result.replaceAll(/([_*`~]{2,})(.+?)\1/g, '$2');

    changed = result !== before;
  }

  return result;
};
