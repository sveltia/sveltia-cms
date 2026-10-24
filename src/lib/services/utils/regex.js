/**
 * Regular expression to match a complete regular expression string with delimiters and optional
 * flags, e.g. `/^.{0,280}$/s`.
 */
// cspell:disable-next-line
const FULL_REGEX_PATTERN = /^\/(?<pattern>.+)\/(?<flags>[dgimsuvy]*)$/;
/**
 * Regular expression to match the `g` (global) and `y` (sticky) flags.
 */
const STATEFUL_FLAGS_REGEX = /[gy]/g;

/**
 * Check whether the given regular expression flags can be used together, e.g. not `mm` or `uv`.
 * @param {string} flags Flags.
 * @returns {boolean} Result.
 */
const areValidFlags = (flags) => {
  try {
    // eslint-disable-next-line no-new
    new RegExp('', flags);

    return true;
  } catch {
    return false;
  }
};

/**
 * Return a RegExp object based on the provided pattern. If the pattern is already a RegExp, it
 * returns it as is, unless a stateful flag has to be dropped. If the pattern is a string, it
 * converts it to a RegExp. If the pattern is neither, it returns undefined.
 *
 * The `g` and `y` flags are always stripped, because they make the returned object stateful:
 * `RegExp.test()` resumes from `lastIndex` and updates it on every call, so a regex reused across a
 * list of values — a collection `filter`, a view filter, a field validation `pattern` — would match
 * only some of them. None of the callers iterate over matches, so the flags have no upside here.
 * @param {any} input Input pattern which can be a string or RegExp.
 * @returns {RegExp | undefined} The RegExp object or undefined if the pattern is invalid.
 */
export const getRegex = (input) => {
  if (input instanceof RegExp) {
    const flags = input.flags.replace(STATEFUL_FLAGS_REGEX, '');

    return flags === input.flags ? input : new RegExp(input.source, flags);
  }

  if (typeof input === 'string' && input) {
    // Parse the regex to support simple pattern, e.g `.{12,}`, and complete expression, e.g.
    // `/^.{0,280}$/s`. A string without both delimiters is used as a pattern in its entirety, like
    // Netlify/Decap CMS does, so a slash at either end of `^/blog/` or `^https?://` is kept
    const { pattern, flags } = input.match(FULL_REGEX_PATTERN)?.groups ?? {};

    if (pattern !== undefined) {
      try {
        // Compile with the flags as written, so a duplicate stateful flag isn’t missed, then drop
        // the stateful flags as for a `RegExp` input
        return getRegex(new RegExp(pattern, flags));
      } catch {
        // With valid flags, the pattern itself is invalid, which is a config error to report rather
        // than to hide by matching the string literally
        if (areValidFlags(flags)) {
          return undefined;
        }

        // The flags are invalid, so the string is likely a plain pattern that just happens to look
        // like a delimited one, e.g. `/posts/dummy`, whose `dummy` repeats the `m` flag. Fall back
        // to using it in its entirety below
      }
    }

    try {
      return new RegExp(input);
    } catch {
      // Ignore invalid regex
    }
  }

  return undefined;
};
