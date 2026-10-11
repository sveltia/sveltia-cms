/**
 * Regular expression to match Markdown images, including those with spaces and brackets in the src,
 * e.g. `![alt text](image.jpg "Image title")`. It also matches images with empty alt text, e.g.
 * `![](image.jpg)`, images with parentheses in the filename, e.g. `![alt](image (1).jpg)`, and
 * supports escaped characters like `![alt](image\(1\).jpg)` and titles with escaped quotes.
 *
 * The pattern runs on untrusted Markdown, so it’s written to match in linear time, like
 * `MARKDOWN_IMAGE_REGEX` in `$lib/services/assets/references`. Every part can only be matched one
 * way, and none of the alt text, source, parenthesized or quoted parts of the source, or title can
 * contain `![`, so a failed match at one `![` doesn’t read the text after the next one again. A
 * title is only looked for at the start of a run of whitespace after the source, so the run isn’t
 * read again from each of its characters. An image nested in another one is matched on its own.
 * @type {RegExp}
 */
export const IMAGE_REGEX =
  /!\[(?<alt>(?:[^\]\\!]|\\(?!!\[).|!(?!\[))*)\]\((?<src>(?:[^"()\\!]|\\(?!!\[).|!(?!\[)|\((?:[^)!]|!(?!\[))*\)|"(?:[^"!]|!(?!\[))*")*?)(?:(?<![^\\]\s)\s+"(?<title>(?:[^"\\!]|\\(?!!\[).|!(?!\[))*)")?\)/;

/**
 * Global version of `IMAGE_REGEX` (with the `g` flag).
 * @type {RegExp}
 */
export const GLOBAL_IMAGE_REGEX = new RegExp(IMAGE_REGEX, 'g');

/**
 * Regular expression to match Markdown linked images, including those with spaces and brackets in
 * the src, e.g. `[![alt text](image.jpg "Image title")](link)`. It also matches linked images with
 * parentheses in the filename, e.g. `[![alt](image (1).jpg)](https://example.com)`. The image
 * part is matched like {@link IMAGE_REGEX}, in linear time, and the link can contain one pair of
 * parentheses, which is looked for only from the link’s first `(`.
 * @type {RegExp}
 */
export const LINKED_IMAGE_REGEX =
  /\[!\[(?<alt2>(?:[^\]\\!]|\\(?!!\[).|!(?!\[))*)\]\((?<src2>(?:[^"()\\!]|\\(?!!\[).|!(?!\[)|\((?:[^)!]|!(?!\[))*\)|"(?:[^"!]|!(?!\[))*")*?)(?:(?<![^\\]\s)\s+"(?<title2>(?:[^"\\!]|\\(?!!\[).|!(?!\[))*)")?\)\](?:\((?<link>[^()]*(?:\([^)]*\)[^)]*|\([^)]*)?)\))/;

/**
 * Regular expression to match either a Markdown image or a linked image.
 * @type {RegExp}
 */
export const IMAGE_OR_LINKED_IMAGE_REGEX = new RegExp(
  `${IMAGE_REGEX.source}|${LINKED_IMAGE_REGEX.source}`,
);
