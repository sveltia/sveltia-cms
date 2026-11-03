/**
 * Pattern matching the alt text of a Markdown image, which can contain balanced brackets, e.g.
 * `Photo [1]` in `![Photo [1]](photo.jpg)`, as CommonMark allows. See {@link IMAGE_REGEX}.
 */
const ALT_PATTERN = [
  String.raw`(?:[^\][\\!]|\\(?!!\[).|!(?!\[)`,
  String.raw`|\[(?:[^\][\\!]|\\(?!!\[).|!(?!\[))*\])*`,
].join('');

/**
 * Pattern matching the source of a Markdown image. See {@link IMAGE_REGEX}.
 */
const SRC_PATTERN = [
  String.raw`(?:[^"()\\!]|\\(?!!\[).|!(?!\[)`,
  String.raw`|\((?:[^)!]|!(?!\[))*\)|"(?:[^"!]|!(?!\[))*")*?`,
].join('');

/**
 * Get the pattern matching the title of a Markdown image between the given quotes, without them.
 * @param {string} quote Double or single quote.
 * @returns {string} Pattern.
 */
const getTitlePattern = (quote) => String.raw`(?:[^${quote}\\!]|\\(?!!\[).|!(?!\[))*`;

/**
 * Get the pattern matching a Markdown image, with the named groups suffixed as given, so the
 * pattern can be used twice in one regular expression.
 * @param {string} [suffix] Suffix of the group names.
 * @returns {string} Pattern.
 */
export const getImagePattern = (suffix = '') =>
  [
    String.raw`!\[(?<alt${suffix}>${ALT_PATTERN})\]\((?<src${suffix}>${SRC_PATTERN})`,
    String.raw`(?:(?<![^\\]\s)\s+(?:"(?<title${suffix}>${getTitlePattern('"')})"`,
    String.raw`|'(?<singleQuotedTitle${suffix}>${getTitlePattern("'")})'))?\)`,
  ].join('');

/**
 * Regular expression to match Markdown images, including those with spaces and brackets in the src,
 * e.g. `![alt text](image.jpg "Image title")`. It also matches images with empty alt text, e.g.
 * `![](image.jpg)`, images with parentheses in the filename, e.g. `![alt](image (1).jpg)`, alt text
 * with balanced brackets, e.g. `![Photo [1]](image.jpg)`, and supports escaped characters like
 * `![alt](image\(1\).jpg)` and titles with escaped quotes. The title can be in double or single
 * quotes, captured as `title` or `singleQuotedTitle`; one in parentheses can’t be told apart from
 * parentheses in the filename, so it’s read as part of the source.
 *
 * The pattern runs on untrusted Markdown, so it’s written to match in linear time, like
 * `MARKDOWN_IMAGE_REGEX` in `rich-text/previews/media-sources`, which shares the pattern. Every
 * part can only be matched one
 * way, and none of the alt text, source, parenthesized or quoted parts of the source, or title can
 * contain `![`, so a failed match at one `![` doesn’t read the text after the next one again. A
 * title is only looked for at the start of a run of whitespace after the source, so the run isn’t
 * read again from each of its characters. An image nested in another one is matched on its own.
 * @type {RegExp}
 */
export const IMAGE_REGEX = new RegExp(getImagePattern());

/**
 * Regular expression to match Markdown linked images, including those with spaces and brackets in
 * the src, e.g. `[![alt text](image.jpg "Image title")](link)`. It also matches linked images with
 * parentheses in the filename, e.g. `[![alt](image (1).jpg)](https://example.com)`. The image
 * part is matched like {@link IMAGE_REGEX}, in linear time, and the link can contain one pair of
 * parentheses, which is looked for only from the link’s first `(`.
 * @type {RegExp}
 */
export const LINKED_IMAGE_REGEX = new RegExp(
  String.raw`\[${getImagePattern('2')}\](?:\((?<link>[^()]*(?:\([^)]*\)[^)]*|\([^)]*)?)\))`,
);

/**
 * Regular expression to match either a Markdown image or a linked image.
 * @type {RegExp}
 */
export const IMAGE_OR_LINKED_IMAGE_REGEX = new RegExp(
  `${IMAGE_REGEX.source}|${LINKED_IMAGE_REGEX.source}`,
);
