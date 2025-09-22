/**
 * Regular expression to match Markdown images, including those with spaces and brackets in the src,
 * e.g. `![alt text](image.jpg "Image title")`. It also matches images with empty alt text, e.g.
 * `![](image.jpg)`, images with parentheses in the filename, e.g. `![alt](image (1).jpg)`, and
 * supports escaped characters like `![alt](image\(1\).jpg)` and titles with escaped quotes.
 * @type {RegExp}
 */
export const IMAGE_REGEX =
  /!\[(?<alt>(?:[^\]\\]|\\.)*)\]\((?<src>(?:[^"()\\]|\\.|\([^)]*\)|"[^"]*")*?)(?:\s+"(?<title>(?:[^"\\]|\\.)*)")?\)/;

/**
 * Global version of `IMAGE_REGEX` (with the `g` flag).
 * @type {RegExp}
 */
export const GLOBAL_IMAGE_REGEX = new RegExp(IMAGE_REGEX, 'g');

/**
 * Regular expression to match Markdown linked images, including those with spaces and brackets in
 * the src, e.g. `[![alt text](image.jpg "Image title")](link)`. It also matches linked images with
 * parentheses in the filename, e.g. `[![alt](image (1).jpg)](https://example.com)`.
 * @type {RegExp}
 */
export const LINKED_IMAGE_REGEX =
  /\[!\[(?<alt2>(?:[^\]\\]|\\.)*)\]\((?<src2>(?:[^"()\\]|\\.|\([^)]*\)|"[^"]*")*?)(?:\s+"(?<title2>(?:[^"\\]|\\.)*)")?\)\](?:\((?<link>[^)]*\([^)]*\)[^)]*|[^)]*)\))/;

/**
 * Regular expression to match either a Markdown image or a linked image.
 * @type {RegExp}
 */
export const IMAGE_OR_LINKED_IMAGE_REGEX = new RegExp(
  `${IMAGE_REGEX.source}|${LINKED_IMAGE_REGEX.source}`,
);
