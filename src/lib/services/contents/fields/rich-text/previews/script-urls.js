/**
 * Local names of the attributes that can navigate to a URL or load one into a frame, where a
 * `javascript:` URL would run a script: `href` also covers `xlink:href` in SVG. An SVG `<animate>`
 * or `<set>` element can also set a link’s `href` with `from`, `to` or `values`, the last one being
 * a semicolon-separated list.
 */
const URL_ATTRIBUTE_NAMES = ['href', 'src', 'action', 'formaction', 'data', 'from', 'to', 'values'];
/**
 * Regular expression testing if an HTML string may contain one of the {@link URL_ATTRIBUTE_NAMES}.
 * An attribute name can’t be written with character references, unlike its value.
 */
const URL_ATTRIBUTE_REGEX = /(?:href|src|action|data|from|to|values)\s*=/i;
/**
 * Regular expression matching the characters a browser removes from a URL before reading its
 * scheme: leading C0 control characters and spaces, and ASCII tabs and newlines anywhere, so
 * `java\tscript:` is still a `javascript:` URL.
 * @see https://url.spec.whatwg.org/#concept-basic-url-parser
 */
// eslint-disable-next-line no-control-regex
const IGNORED_URL_CHARS_REGEX = /^[\u0000-\u0020]+|[\t\n\r]/g;
/**
 * Check if the given attribute value is a `javascript:` URL.
 * @param {string} value Attribute value, with any character references decoded.
 * @returns {boolean} Result.
 */
const isScriptURL = (value) => /^javascript:/i.test(value.replaceAll(IGNORED_URL_CHARS_REGEX, ''));

/**
 * Remove the attributes holding a `javascript:` URL from the given HTML, e.g. a Markdown link like
 * `[Click me](javascript:alert(1))`. This is used for the preview of a RichText field with the
 * `sanitize_preview` option disabled, which otherwise renders the HTML as is: a new entry’s body
 * can be given in the URL, so anyone can craft a link to the CMS with one.
 * @param {string} html HTML.
 * @returns {string} HTML without `javascript:` URLs, or the same string if there was none.
 */
export const removeScriptURLs = (html) => {
  // Avoid parsing the HTML if there’s no URL attribute
  if (!URL_ATTRIBUTE_REGEX.test(html)) {
    return html;
  }

  const template = document.createElement('template');
  let removed = false;

  // The content of a template is inert, so nothing is loaded or run here
  template.innerHTML = html;

  template.content.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach(({ localName, name, value }) => {
      if (URL_ATTRIBUTE_NAMES.includes(localName) && value.split(';').some(isScriptURL)) {
        element.removeAttribute(name);
        removed = true;
      }
    });
  });

  // Keep the HTML as written unless something was removed
  return removed ? template.innerHTML : html;
};
