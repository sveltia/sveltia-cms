import { sanitize } from 'isomorphic-dompurify';
import { Marked } from 'marked';

/**
 * Elements a comment can have: what GitHub-flavoured Markdown produces, short of raw HTML.
 */
const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'input',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

/**
 * Attributes those elements can have. A task list item’s check box is shown, never used.
 */
const ALLOWED_ATTR = ['alt', 'checked', 'disabled', 'href', 'src', 'start', 'title', 'type'];
/**
 * Private Markdown parser for comments, which is unaffected by the extensions a site adds to the
 * shared `window.marked` instance, e.g. a renderer that outputs other HTML, or an async one that
 * makes `parse()` return a `Promise`.
 */
const markdownParser = new Marked({ gfm: true, breaks: true, async: false });

/**
 * Render a comment’s Markdown as HTML that’s safe to show: anything that could run script, style
 * the page, submit a form or load something from elsewhere is dropped. Links open in a new tab, as
 * a comment usually points away from the CMS, e.g. to a deploy preview.
 * @param {string} markdown Markdown.
 * @returns {string} HTML.
 */
export const renderCommentBody = (markdown) => {
  const html = /** @type {string} */ (markdownParser.parse(markdown));

  const body = /** @type {HTMLElement} */ (
    /** @type {unknown} */ (sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, RETURN_DOM: true }))
  );

  body.querySelectorAll('a').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  // Only a task list item’s check box is kept: an image button would load a remote image too
  body.querySelectorAll('input').forEach((input) => {
    if (input.type === 'checkbox') {
      input.disabled = true;
    } else {
      input.remove();
    }
  });

  // A remote image would tell its author who has read the comment, and when, so it’s shown as a
  // link to follow instead. An image in a data URL loads nothing, and is kept; a relative URL has
  // nothing to point to in the CMS, and is dropped.
  body.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('src') ?? '';
    const { protocol } = URL.parse(src) ?? {};

    if (protocol === 'data:') {
      return;
    }

    if (protocol === 'http:' || protocol === 'https:') {
      const link = Object.assign(image.ownerDocument.createElement('a'), {
        href: src,
        target: '_blank',
        rel: 'noopener noreferrer',
        textContent: image.alt || src,
      });

      image.replaceWith(link);
    } else {
      image.remove();
    }
  });

  return body.innerHTML;
};
