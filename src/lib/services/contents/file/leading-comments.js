import { fileStates, updateFileState } from '$lib/services/contents/file/state';

/**
 * Regular expression matching the lines at the top of a YAML or TOML document that are blank or
 * hold only a comment.
 */
const COMMENT_OR_BLANK_LINES_REGEX = /^(?:[ \t]*(?:#.*)?(?:\n|$))*/;

/**
 * Get the comments at the top of the given YAML or TOML document: the comment lines, along with the
 * blank lines between them, up to the last blank line before the first line of data. A blank line
 * is required: a comment right above the first line of data is taken as a comment on it and left
 * out, as the one written for the `comment` field option would otherwise be repeated on every save.
 * A document holding nothing else keeps all of its comments.
 * @param {string} str Document.
 * @returns {string | undefined} Comments, or `undefined` if there are none.
 */
export const getLeadingComment = (str) => {
  // Most documents have no comments; skip looking for them
  if (!str.trimStart().startsWith('#')) {
    return undefined;
  }

  const [prefix] = /** @type {RegExpMatchArray} */ (str.match(COMMENT_OR_BLANK_LINES_REGEX));

  // The comments end at the last blank line above the first line of data. Without one, they all
  // belong to that line
  const comment =
    prefix.length === str.length ? str : (prefix.match(/^[\s\S]*\n[ \t]*\n/)?.[0] ?? '');

  return comment.trim() || undefined;
};

/**
 * Remember the comments at the top of the given document read from the given file, or forget the
 * ones remembered for the file if it has none. The CMS writes the whole file from the entry content
 * on every save, which drops the comments, so the ones at the top, typically a note about the file,
 * are written back.
 * @param {string} path File path.
 * @param {string} str YAML or TOML document, which is the whole file or its front matter.
 * @see https://github.com/decaporg/decap-cms/issues/5099
 */
export const rememberLeadingComment = (path, str) => {
  const leadingComment = getLeadingComment(str);

  // Most files have none to remember or forget; skip updating their state
  if (leadingComment || fileStates.get(path)?.leadingComment) {
    updateFileState(path, { leadingComment });
  }
};

/**
 * Add the given comments at the top of the given document, followed by a blank line, so they’re
 * read back as the comments at the top rather than as the comment of the first line of data.
 * @param {string} str YAML or TOML document.
 * @param {string} [comment] Comments.
 * @returns {string} Document.
 */
export const prependLeadingComment = (str, comment) =>
  comment ? (str ? `${comment}\n\n${str}` : comment) : str;
