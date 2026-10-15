import {
  getMediaElements,
  mapSrcset,
  MEDIA_TAG_NAME_PATTERN,
  MEDIA_TAG_REGEX,
  MEDIA_URL_ATTRIBUTES,
  parseSrcset,
} from '$lib/services/contents/fields/rich-text/previews/media-urls';
import {
  isInsideTag,
  parseHTMLFragment,
  parseStartTag,
  serializeStartTag,
} from '$lib/services/utils/html';

/**
 * @import { RichTextValueFormat } from '$lib/types/public';
 */

/**
 * Regular expression to match `![alt](src "title")`, capturing the source. The alt text runs up to
 * the first `](`, so it can contain brackets, and the source up to the first `)` or an optional
 * double-quoted title, which can contain parentheses and escaped quotes.
 *
 * The pattern runs on untrusted Markdown, so it’s written to match in linear time. Every part can
 * only be matched one way, and neither the alt text nor the source can contain `![`, so a failed
 * match at one `![` doesn’t read the text after the next one again. A title is only looked for
 * right after the source’s last non-space character, and it can’t contain an unescaped quote, so
 * each quote is read as the start of a title at most once. An image nested in the alt text or
 * source of an unclosed one is matched on its own instead.
 */
export const MARKDOWN_IMAGE_REGEX =
  /!\[(?:[^\]\n!]|!(?!\[)|\](?!\())*\]\(((?:[^\n!)]|!(?!\[))+?)(?:(?<!\s)\s+"(?:[^"\\\n]|\\.)*")?\)/g;

/**
 * Pattern matching the start tag of a media element, e.g. `<img src="a.png">` or `<video
 * poster="a.jpg">`, written as raw HTML in a Markdown body. Attribute values can be quoted with
 * either kind of quotes, and contain `>` when quoted.
 *
 * The pattern runs on untrusted Markdown, so it’s written to match in linear time: neither an
 * attribute value nor anything else in the tag can contain `<`, so a failed match at one `<`
 * doesn’t read the text after the next one again. A tag with `<` in an attribute value, as in
 * `alt="a<b"`, is missed, which is rare enough.
 */
const MEDIA_START_TAG_PATTERN = [
  `<(?:${MEDIA_TAG_NAME_PATTERN})(?=[\\s/>])`,
  '(?:[^<>"\']|"[^"<]*"|\'[^\'<]*\')*>',
].join('');

/**
 * Regular expression to match either a Markdown image, capturing its source as the first group, or
 * the start tag of a media element written as raw HTML, which Markdown allows, captured as the
 * second group. Both kinds are displayed in the preview, so both refer to the files.
 */
export const MARKDOWN_MEDIA_REGEX = new RegExp(
  `${MARKDOWN_IMAGE_REGEX.source}|(${MEDIA_START_TAG_PATTERN})`,
  'gi',
);

/**
 * Function called for each media URL found in a value, returning a new URL to replace it with,
 * `null` to remove it, or `undefined` to leave it as is.
 * @typedef {(url: string) => string | null | undefined} MediaURLCallback
 */

/**
 * Pass each URL in the URL attributes of a media element to the given callback, e.g. an image
 * `src`, a video `poster` or each URL in a `srcset`, and update the attributes with the result. An
 * attribute left with no URL is removed. The attributes are read with the character references
 * decoded, e.g. `a&amp;b.jpg` as `a&b.jpg`, the same as the file name they refer to. An empty URL
 * is skipped.
 * @param {Element} element Media element.
 * @param {MediaURLCallback} callback Callback.
 * @returns {boolean} Whether any attribute has been changed.
 */
export const updateMediaElementURLs = (element, callback) => {
  let updated = false;

  MEDIA_URL_ATTRIBUTES[element.localName].forEach((name) => {
    const value = element.getAttribute(name);

    if (!value) {
      return;
    }

    if (name !== 'srcset') {
      const url = callback(value);

      if (url === null) {
        element.removeAttribute(name);
        updated = true;
      } else if (url !== undefined && url !== value) {
        element.setAttribute(name, url);
        updated = true;
      }

      return;
    }

    const newValue = mapSrcset(parseSrcset(value), (url) => callback(url));

    if (newValue === undefined) {
      return;
    }

    if (newValue === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, newValue);
    }

    updated = true;
  });

  return updated;
};

/**
 * Pass each URL in the start tag of a media element written as raw HTML in a Markdown body, as
 * matched by {@link MARKDOWN_MEDIA_REGEX}, to the given callback, and update the parsed element
 * with the result. A tag sitting inside another tag isn’t a media element.
 * @param {object} args Arguments.
 * @param {string} args.value Markdown body.
 * @param {string} args.tag Start tag found in the body.
 * @param {number} args.index Position of the tag in the body.
 * @param {MediaURLCallback} args.callback Callback.
 * @returns {Element | undefined} Parsed element with the URLs updated, to be serialized with
 * `serializeStartTag()` as needed, or `undefined` if the tag is left as is, because it sits inside
 * another tag or none of its URLs is changed.
 */
export const rewriteMediaStartTag = ({ value, tag, index, callback }) => {
  if (isInsideTag(value, index)) {
    return undefined;
  }

  const element = parseStartTag(tag);

  return updateMediaElementURLs(element, callback) ? element : undefined;
};

/**
 * Pass each media URL in a Markdown body to the given callback, and replace it with the result: the
 * source of a Markdown image, or a URL attribute of a media element written as raw HTML. Only the
 * URL within each image or tag is replaced, so the same file name mentioned anywhere else in the
 * text, or a source whose name contains another’s, e.g. `hero-image.png` for `image.png`, isn’t
 * hit. A tag is serialized again only if one of its URLs is replaced.
 * @param {string} value Markdown body.
 * @param {MediaURLCallback} callback Callback. Removing a URL isn’t supported here, so `null`
 * leaves it as is.
 * @returns {string} New body.
 */
const updateMarkdownMediaURLs = (value, callback) =>
  value.replace(
    MARKDOWN_MEDIA_REGEX,
    (
      markup,
      /** @type {string | undefined} */ src,
      /** @type {string | undefined} */ tag,
      /** @type {number} */ offset,
    ) => {
      if (tag !== undefined) {
        const element = rewriteMediaStartTag({
          value,
          tag,
          index: offset,
          /**
           * Leave a URL as is rather than remove it.
           * @param {string} url URL.
           * @returns {string | undefined} New URL.
           */
          callback: (url) => callback(url) ?? undefined,
        });

        return element ? serializeStartTag(element) : markup;
      }

      const source = /** @type {string} */ (src);
      const url = callback(source);

      if (typeof url !== 'string') {
        return markup;
      }

      // The source comes right after the first `](`, as the alt text is matched lazily
      const start = markup.indexOf('](') + 2;

      return `${markup.slice(0, start)}${url}${markup.slice(start + source.length)}`;
    },
  );

/**
 * Pass each media URL in an HTML body to the given callback, and replace it with the result. The
 * HTML is parsed rather than matched with a regular expression, so a tag in a comment, an attribute
 * value or a `<script>` element isn’t taken for a media element. The result is serialized again,
 * so a new URL is escaped as needed, and the same file name mentioned anywhere else in the HTML,
 * e.g. in a link, isn’t hit. The serialization may differ from the original in formatting, e.g. the
 * quotes around attribute values, so the original is returned as is if no URL is replaced.
 * @param {string} value HTML body.
 * @param {MediaURLCallback} callback Callback. A URL can also be removed.
 * @returns {string} New body.
 */
const updateHTMLMediaURLs = (value, callback) => {
  // Avoid parsing the HTML if there’s no media element
  if (!MEDIA_TAG_REGEX.test(value)) {
    return value;
  }

  const template = parseHTMLFragment(value);
  let updated = false;

  getMediaElements(template).forEach((element) => {
    updated = updateMediaElementURLs(element, callback) || updated;
  });

  return updated ? template.innerHTML : value;
};

/**
 * Pass each media URL in a Markdown or RichText field value to the given callback, and replace it
 * with the result. See {@link MARKDOWN_MEDIA_REGEX} and `MEDIA_URL_ATTRIBUTES` for what’s a media
 * URL.
 * @param {string} value Field value.
 * @param {RichTextValueFormat} format Value format, as returned by `getValueFormat()`.
 * @param {MediaURLCallback} callback Callback.
 * @returns {string} New value, or the original one if nothing is replaced.
 */
export const updateRichTextMediaURLs = (value, format, callback) =>
  format === 'html'
    ? updateHTMLMediaURLs(value, callback)
    : updateMarkdownMediaURLs(value, callback);

/**
 * Get the media URLs in a Markdown or RichText field value, without duplicates.
 * @param {string} value Field value.
 * @param {RichTextValueFormat} format Value format, as returned by `getValueFormat()`.
 * @returns {string[]} URLs, in the order found.
 */
export const getRichTextMediaSources = (value, format) => {
  /** @type {Set<string>} */
  const sources = new Set();

  updateRichTextMediaURLs(value, format, (url) => {
    sources.add(url);

    return undefined;
  });

  return [...sources];
};

/**
 * Replace the media URLs in a Markdown or RichText field value.
 * @param {string} value Field value.
 * @param {Map<string, string | undefined>} newSources New URLs keyed by the current ones, as
 * returned by {@link getRichTextMediaSources}. A URL that’s missing or mapped to `undefined` is
 * left as is.
 * @param {RichTextValueFormat} format Value format, as returned by `getValueFormat()`.
 * @returns {string} New value.
 */
export const replaceRichTextMediaSources = (value, newSources, format) =>
  [...newSources.values()].some((newSource) => newSource !== undefined)
    ? updateRichTextMediaURLs(value, format, (url) => newSources.get(url))
    : value;
