import { updateFieldValue } from '$lib/services/contents/draft/update';
import { getFieldLocaleAccess } from '$lib/services/contents/editor/locale';
import { RICH_TEXT_FIELD_TYPES } from '$lib/services/contents/fields';
import { getValueFormat } from '$lib/services/contents/fields/rich-text';
import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';
import { removeStockCredits } from '$lib/services/integrations/media-libraries/stock/credit';

/**
 * @import { DraftValueStoreKey, EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import {
 * FieldKeyPath,
 * MarkdownField,
 * RichTextField,
 * RichTextValueFormat,
 * VisibleField,
 * } from '$lib/types/public';
 */

/**
 * @typedef {object} CreditTargetField
 * @property {FieldKeyPath} keyPath Key path of the field, which is its name.
 * @property {MarkdownField | RichTextField} fieldConfig Field configuration.
 * @property {RichTextValueFormat} format Format of the field value.
 */

/**
 * Find the field a photo credit can be inserted into: the first top-level Markdown or RichText
 * field that takes multiple paragraphs and can be edited in the given locale. A field nested in a
 * List or Object field is left out, as there’s no telling which item the credit would belong to.
 * @param {object} args Arguments.
 * @param {EntryDraft | null | undefined} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale being edited.
 * @returns {CreditTargetField | undefined} Field, if any.
 */
export const getCreditTargetField = ({ draft, locale }) => {
  if (!draft) {
    return undefined;
  }

  const valueMap = draft.currentValues[locale] ?? {};

  const fieldConfig = /** @type {MarkdownField | RichTextField | undefined} */ (
    draft.fields.find((field) => {
      const { name, widget = 'string' } = field;

      if (!RICH_TEXT_FIELD_TYPES.includes(widget)) {
        return false;
      }

      const { readonly, multiline } = /** @type {MarkdownField | RichTextField} */ (field);

      if (readonly === true || multiline === false) {
        return false;
      }

      const { isShown, isDuplicated } = getFieldLocaleAccess({
        draft,
        fieldConfig: field,
        keyPath: name,
        locale,
        valueMap,
      });

      return isShown && !isDuplicated;
    })
  );

  if (!fieldConfig) {
    return undefined;
  }

  return { keyPath: fieldConfig.name, fieldConfig, format: getValueFormat(fieldConfig) };
};

/**
 * Split photo credits into lines, trimmed, leaving out empty ones.
 * @param {string} credit Photo credits in HTML, one per line.
 * @returns {string[]} Credits.
 */
const splitCredits = (credit) =>
  credit
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Escape the characters that have a meaning in Markdown inline text. `!` is escaped too, as it
 * would make a link right after it an image.
 * @param {string} text Plain text.
 * @returns {string} Escaped text.
 */
const escapeMarkdown = (text) => text.replace(/[\\`*_[\]<>!]/g, '\\$&');

/**
 * Convert a single photo credit from HTML to Markdown. A credit is sanitized to contain only text
 * and links, so the links become Markdown links and everything else becomes text.
 * @param {string} html Photo credit HTML, e.g. `Photo by <a href="…">Name</a> on <a…>Unsplash</a>`.
 * @returns {string} Markdown.
 */
const convertCreditLine = (html) => {
  const { body } = new DOMParser().parseFromString(html, 'text/html');

  // The text content of an element or a text node is never `null`, only that of a document
  return [...body.childNodes]
    .map((node) => {
      const text = escapeMarkdown(/** @type {string} */ (node.textContent));

      if (node instanceof HTMLAnchorElement) {
        // These would end the link early or make it read otherwise. `encodeURIComponent()` can’t be
        // used, as it leaves the parentheses alone and encodes the rest of the URL as well
        const href = (node.getAttribute('href') ?? '').replace(
          /[ ()<>]/g,
          (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
        );

        return `[${text}](${href})`;
      }

      return text;
    })
    .join('')
    .trim();
};

/**
 * Convert photo credits from HTML to Markdown.
 * @param {string} credit Photo credits in HTML, one per line.
 * @returns {string} Markdown, one paragraph per credit.
 */
export const convertCreditToMarkdown = (credit) =>
  splitCredits(credit).map(convertCreditLine).filter(Boolean).join('\n\n');

/**
 * Format photo credits for a field value in the given format.
 * @param {string} credit Photo credits in HTML, one per line.
 * @param {RichTextValueFormat} format Field value format.
 * @returns {string} Formatted credits.
 */
export const formatCredit = (credit, format) =>
  format === 'html'
    ? splitCredits(credit)
        .map((line) => `<p>${line}</p>`)
        .join('\n')
    : convertCreditToMarkdown(credit);

/**
 * Append photo credits to the end of the given field’s value, as a new paragraph.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale being edited.
 * @param {CreditTargetField} args.target Field to insert the credits into.
 * @param {string} args.credit Photo credits in HTML, one per line.
 */
export const insertCredit = ({ draft, locale, target, credit }) => {
  const { keyPath, fieldConfig, format } = target;
  const formatted = formatCredit(credit, format);

  if (!formatted) {
    return;
  }

  const currentValue = draft.currentValues[locale]?.[keyPath];
  const existing = typeof currentValue === 'string' ? currentValue.trimEnd() : '';

  updateFieldValue({
    draft,
    valueStoreKey: 'currentValues',
    locale,
    keyPath,
    i18n: fieldConfig.i18n,
    value: existing ? `${existing}\n\n${formatted}` : formatted,
  });
};

/**
 * Field types a Caption field can have to take a photo credit.
 */
const CAPTION_FIELD_TYPES = ['string', 'text'];

/**
 * Get the key path of the Caption field of the rich text editor component a file field belongs to,
 * so a photo credit can be inserted there, e.g. `body:c12:caption` for `body:c12:src`. The built-in
 * image components have one, and so can a custom component: a String or Text field named `caption`
 * next to the file field, which can be edited.
 * @param {object} args Arguments.
 * @param {DraftValueStoreKey} args.valueStoreKey Value store key of the file field.
 * @param {string | undefined} args.componentName Name of the component the field belongs to.
 * @param {FieldKeyPath} args.keyPath Key path of the file field.
 * @returns {FieldKeyPath | undefined} Key path, or `undefined` if the field doesn’t belong to such
 * a component, or is nested in another field of the component.
 */
export const getCreditCaptionKeyPath = ({ valueStoreKey, componentName, keyPath }) => {
  if (valueStoreKey !== 'extraValues' || !componentName) {
    return undefined;
  }

  const { fields = [] } = getComponentDef(componentName) ?? {};

  const { prefix, name: fieldName } =
    keyPath.match(/^(?<prefix>.+:)(?<name>[^:.]+)$/)?.groups ?? {};

  const isComponentField = fields.some(
    ({ name, widget }) => name === fieldName && (widget === 'image' || widget === 'file'),
  );

  const hasCaptionField = fields.some(
    (field) =>
      field.name === 'caption' &&
      CAPTION_FIELD_TYPES.includes(field.widget ?? 'string') &&
      /** @type {VisibleField} */ (field).readonly !== true,
  );

  return isComponentField && hasCaptionField ? `${prefix}caption` : undefined;
};

/**
 * Add photo credits to the Caption field of a rich text editor component, found with
 * {@link getCreditCaptionKeyPath}. The credits are joined with a space, as the built-in image
 * components write the caption on a single line, and added after any caption already there. A
 * credit already in the caption is removed, as it belongs to the image the component held before.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale being edited.
 * @param {FieldKeyPath} args.keyPath Key path of the Caption field.
 * @param {string} args.credit Photo credits in HTML, one per line.
 */
export const insertCreditCaption = ({ draft, locale, keyPath, credit }) => {
  const formatted = splitCredits(credit).join(' ');

  if (!formatted) {
    return;
  }

  const valueMap = draft.extraValues[locale] ?? (draft.extraValues[locale] = {});
  const currentValue = valueMap[keyPath];
  const existing = typeof currentValue === 'string' ? removeStockCredits(currentValue) : '';

  valueMap[keyPath] = existing ? `${existing} ${formatted}` : formatted;
};
