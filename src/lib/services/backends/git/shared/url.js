/**
 * Encode a slash-separated value, such as a file path or a branch name, for use in a URL path,
 * segment by segment. `encodeURI` would leave `#` and `?` as they are, which end the path, so a
 * value containing them would be cut short and the request would address something else — a Git
 * branch name can contain `#`, for example, and `cms/posts/c#` would become `cms/posts/c`.
 * @param {string} path File path or branch name.
 * @returns {string} Encoded value, with the slashes kept.
 */
export const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');
