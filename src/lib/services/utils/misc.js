// cspell:disable-next-line
const FULL_REGEX_PATTERN = /^\/?(?<pattern>.+?)(?:\/(?<flags>[dgimsuy]*))?$/;

/**
 * Returns a RegExp object based on the provided pattern. If the pattern is already a RegExp, it
 * returns it as is. If the pattern is a string, it converts it to a RegExp. If the pattern is
 * neither, it returns undefined.
 * @param {any} input Input pattern which can be a string or RegExp.
 * @returns {RegExp | undefined} The RegExp object or undefined if the pattern is invalid.
 */
export const getRegex = (input) => {
  if (input instanceof RegExp) {
    return input;
  }

  if (typeof input === 'string') {
    // Parse the regex to support simple pattern, e.g `.{12,}`, and complete expression, e.g.
    // `/^.{0,280}$/s`
    const { pattern, flags } = input.match(FULL_REGEX_PATTERN)?.groups ?? {};

    if (pattern) {
      try {
        return new RegExp(pattern, flags);
      } catch {
        // Ignore invalid regex
      }
    }
  }

  return undefined;
};
