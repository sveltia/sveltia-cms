/**
 * Encode image URLs in Markdown to ensure spaces are properly handled.
 * E.g. `![alt](my image.png)` -> `![alt](my%20image.png)`.
 * @param {...any} args Arguments from the regex match.
 * @returns {string} The encoded image Markdown string.
 * @see https://github.com/markedjs/marked/issues/1639
 */
export const encodeImageSrc = (...args) => {
  const { alt, src, title } = args.at(-1);
  const eSrc = src.replaceAll(' ', '%20');

  return title ? `![${alt}](${eSrc} "${title}")` : `![${alt}](${eSrc})`;
};
