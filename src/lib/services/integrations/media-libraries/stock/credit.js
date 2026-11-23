import { escapeAttr, escapeHTML } from '$lib/services/utils/string';

/**
 * Create a photo credit for a stock photo, linking the whole text to the photo page, e.g. `<a
 * href="…">Photo by Jane on Pexels</a>`.
 * @param {object} args Arguments.
 * @param {string} args.name Photographer name.
 * @param {string} args.serviceLabel Service name, e.g. `Pexels`.
 * @param {string} args.url Photo page URL.
 * @returns {string} Credit HTML.
 */
export const createLinkedCredit = ({ name, serviceLabel, url }) =>
  `<a href="${escapeAttr(url)}">Photo by ${escapeHTML(name)} on ${serviceLabel}</a>`;

/**
 * Create a photo credit for a stock photo, linking the photographer and the service separately,
 * e.g. `Photo by <a href="…">Jane</a> on <a href="…">Unsplash</a>`.
 * @param {object} args Arguments.
 * @param {string} args.name Photographer name.
 * @param {string} args.profileURL Photographer profile URL.
 * @param {string} args.serviceLabel Service name, e.g. `Unsplash`.
 * @param {string} args.serviceURL Service URL.
 * @returns {string} Credit HTML.
 */
export const createAttributedCredit = ({ name, profileURL, serviceLabel, serviceURL }) =>
  `Photo by <a href="${escapeAttr(profileURL)}">${escapeHTML(name)}</a> on ` +
  `<a href="${escapeAttr(serviceURL)}">${serviceLabel}</a>`;

/**
 * Regular expression matching a photo credit created with {@link createLinkedCredit} or
 * {@link createAttributedCredit}, also once sanitized, which may add or reorder attributes. The
 * name is escaped there, so it can’t contain `<`. The whitespace around the credit is matched as
 * well, so the text on both sides can be joined with a single space when it’s removed.
 */
const STOCK_CREDIT_REGEX = new RegExp(
  [
    String.raw`\s*(?:`,
    String.raw`Photo by <a\s[^>]*>[^<]*<\/a> on <a\s[^>]*>[^<]*<\/a>`,
    String.raw`|<a\s[^>]*>Photo by [^<]* on [^<]*<\/a>`,
    String.raw`)\s*`,
  ].join(''),
  'g',
);

/**
 * Remove the photo credits created with {@link createLinkedCredit} or
 * {@link createAttributedCredit} from the given HTML, e.g. a caption, joining the text around each
 * with a single space.
 * @param {string} html HTML.
 * @returns {string} HTML without the credits, trimmed.
 */
export const removeStockCredits = (html) => html.replace(STOCK_CREDIT_REGEX, ' ').trim();
