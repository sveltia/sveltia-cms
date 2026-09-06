// cspell:disable-next-line
const FULL_REGEX_PATTERN = /^\/?(?<pattern>.+?)(?:\/(?<flags>[dgimsuy]*))?$/;
/**
 * Regular expression to match the `g` (global) and `y` (sticky) flags.
 */
const STATEFUL_FLAGS_REGEX = /[gy]/g;

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

  if (typeof input === 'string') {
    // Parse the regex to support simple pattern, e.g `.{12,}`, and complete expression, e.g.
    // `/^.{0,280}$/s`
    const { pattern, flags } = input.match(FULL_REGEX_PATTERN)?.groups ?? {};

    if (pattern) {
      try {
        return new RegExp(pattern, flags?.replace(STATEFUL_FLAGS_REGEX, ''));
      } catch {
        // Ignore invalid regex
      }
    }
  }

  return undefined;
};
