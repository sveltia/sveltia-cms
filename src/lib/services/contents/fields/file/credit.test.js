// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from 'vitest';

import { customComponentRegistry } from '$lib/services/api/registries';
import { updateFieldValue } from '$lib/services/contents/draft/update';
import { getFieldLocaleAccess } from '$lib/services/contents/editor/locale';
import {
  convertCreditToMarkdown,
  formatCredit,
  getCreditCaptionKeyPath,
  getCreditTargetField,
  insertCredit,
  insertCreditCaption,
} from '$lib/services/contents/fields/file/credit';

/**
 * @import { DraftValueStoreKey, EntryDraft } from '$lib/types/private';
 * @import { Field, MarkdownField, RichTextField } from '$lib/types/public';
 */

vi.mock('@sveltia/i18n', async () => (await import('$lib/test/i18n')).createI18nMock());
vi.mock('$lib/services/contents/draft/update', () => ({ updateFieldValue: vi.fn() }));
vi.mock('$lib/services/contents/editor/locale', () => ({
  getFieldLocaleAccess: vi.fn(({ fieldConfig, locale }) => ({
    isShown: locale === 'en' || fieldConfig.i18n === true || fieldConfig.i18n === 'duplicate',
    isDuplicated: locale !== 'en' && fieldConfig.i18n === 'duplicate',
  })),
}));

const UNSPLASH_CREDIT =
  'Photo by <a href="https://unsplash.com/@jane?utm_source=sveltia-cms&amp;utm_medium=referral">' +
  'Jane_Doe</a> on <a href="https://unsplash.com/?utm_source=sveltia-cms&amp;utm_medium=referral">' +
  'Unsplash</a>';

const UNSPLASH_CREDIT_MD =
  'Photo by [Jane\\_Doe](https://unsplash.com/@jane?utm_source=sveltia-cms&utm_medium=referral)' +
  ' on [Unsplash](https://unsplash.com/?utm_source=sveltia-cms&utm_medium=referral)';

/**
 * Create a draft with the given fields.
 * @param {Field[]} fields Fields.
 * @param {Record<string, Record<string, any>>} [currentValues] Values.
 * @returns {EntryDraft} Draft.
 */
const createDraft = (fields, currentValues = { en: {} }) =>
  /** @type {EntryDraft} */ (/** @type {unknown} */ ({ fields, currentValues }));

describe('getCreditTargetField()', () => {
  test('returns nothing without a draft', () => {
    expect(getCreditTargetField({ draft: undefined, locale: 'en' })).toBeUndefined();
    expect(getCreditTargetField({ draft: null, locale: 'en' })).toBeUndefined();
  });

  test('returns nothing without a Markdown field', () => {
    const draft = createDraft([
      { name: 'title', widget: 'string' },
      { name: 'text' },
      { name: 'image', widget: 'image' },
    ]);

    expect(getCreditTargetField({ draft, locale: 'en' })).toBeUndefined();
  });

  test('returns the first Markdown or RichText field', () => {
    const body = /** @type {RichTextField} */ ({ name: 'body', widget: 'richtext' });

    const draft = createDraft([
      { name: 'title', widget: 'string' },
      body,
      { name: 'notes', widget: 'markdown' },
    ]);

    expect(getCreditTargetField({ draft, locale: 'en' })).toEqual({
      keyPath: 'body',
      fieldConfig: body,
      format: 'markdown',
    });
    expect(getFieldLocaleAccess).toHaveBeenCalledWith({
      draft,
      fieldConfig: body,
      keyPath: 'body',
      locale: 'en',
      valueMap: {},
    });
  });

  test('returns the value format of the field', () => {
    const body = /** @type {RichTextField} */ ({
      name: 'body',
      widget: 'richtext',
      format: 'html',
    });

    expect(getCreditTargetField({ draft: createDraft([body]), locale: 'en' })).toEqual({
      keyPath: 'body',
      fieldConfig: body,
      format: 'html',
    });
  });

  test('skips a field that can’t take the credit', () => {
    const draft = createDraft(
      [
        /** @type {RichTextField} */ ({ name: 'summary', widget: 'richtext', multiline: false }),
        /** @type {MarkdownField} */ ({ name: 'locked', widget: 'markdown', readonly: true }),
        /** @type {MarkdownField} */ ({ name: 'shared', widget: 'markdown', i18n: 'duplicate' }),
        /** @type {MarkdownField} */ ({ name: 'untranslated', widget: 'markdown' }),
        /** @type {MarkdownField} */ ({ name: 'body', widget: 'markdown', i18n: true }),
      ],
      { en: {}, ja: {} },
    );

    expect(getCreditTargetField({ draft, locale: 'ja' })?.keyPath).toBe('body');
    // Only `multiline: false` and `readonly` matter in the default locale
    expect(getCreditTargetField({ draft, locale: 'en' })?.keyPath).toBe('shared');
  });

  test('takes a locale without values', () => {
    const draft = createDraft([{ name: 'body', widget: 'markdown', i18n: true }], {});

    expect(getCreditTargetField({ draft, locale: 'ja' })?.keyPath).toBe('body');
    expect(getFieldLocaleAccess).toHaveBeenCalledWith(expect.objectContaining({ valueMap: {} }));
  });
});

describe('convertCreditToMarkdown()', () => {
  test('converts the links of a credit', () => {
    expect(convertCreditToMarkdown(UNSPLASH_CREDIT)).toBe(UNSPLASH_CREDIT_MD);
  });

  test('keeps plain text, escaping Markdown syntax', () => {
    expect(convertCreditToMarkdown('Photo by *Melvin* [1]')).toBe('Photo by \\*Melvin\\* \\[1\\]');
    // A link right after `!` stays a link rather than becoming an image
    expect(convertCreditToMarkdown('Wow!<a href="https://x/">Jane!</a>')).toBe(
      'Wow\\![Jane\\!](https://x/)',
    );
  });

  test('puts each credit in its own paragraph, dropping empty lines', () => {
    expect(
      convertCreditToMarkdown(
        'Photo by <a href="https://example.com/a">A</a>\n\nPhoto by <a href="https://example.com/b">B</a>',
      ),
    ).toBe('Photo by [A](https://example.com/a)\n\nPhoto by [B](https://example.com/b)');
  });

  test('encodes spaces, parentheses and angle brackets in a link URL', () => {
    expect(convertCreditToMarkdown('<a href="https://example.com/a (b)<c>">A</a>')).toBe(
      '[A](https://example.com/a%20%28b%29%3Cc%3E)',
    );
  });

  test('takes a link without a URL', () => {
    expect(convertCreditToMarkdown('Photo by <a>A</a>')).toBe('Photo by [A]()');
  });
});

describe('formatCredit()', () => {
  test('formats credits as Markdown', () => {
    expect(formatCredit(UNSPLASH_CREDIT, 'markdown')).toBe(UNSPLASH_CREDIT_MD);
  });

  test('formats credits as HTML paragraphs', () => {
    expect(formatCredit(`${UNSPLASH_CREDIT}\n \nPhoto by Melvin `, 'html')).toBe(
      `<p>${UNSPLASH_CREDIT}</p>\n<p>Photo by Melvin</p>`,
    );
  });
});

describe('insertCredit()', () => {
  const fieldConfig = /** @type {RichTextField} */ ({
    name: 'body',
    widget: 'richtext',
    i18n: 'sync',
  });

  test('appends the credit to the field value as a new paragraph', () => {
    const draft = createDraft([fieldConfig], { en: { body: 'Hello world.\n\n' } });

    insertCredit({
      draft,
      locale: 'en',
      target: { keyPath: 'body', fieldConfig, format: 'markdown' },
      credit: UNSPLASH_CREDIT,
    });

    expect(updateFieldValue).toHaveBeenCalledWith({
      draft,
      valueStoreKey: 'currentValues',
      locale: 'en',
      keyPath: 'body',
      i18n: 'sync',
      value: `Hello world.\n\n${UNSPLASH_CREDIT_MD}`,
    });
  });

  test('sets the credit as the value of an empty field', () => {
    const draft = createDraft([fieldConfig], { en: { body: '' } });

    insertCredit({
      draft,
      locale: 'en',
      target: { keyPath: 'body', fieldConfig, format: 'html' },
      credit: 'Photo by Melvin',
    });

    expect(updateFieldValue).toHaveBeenCalledWith(
      expect.objectContaining({ value: '<p>Photo by Melvin</p>' }),
    );
  });

  test('sets the credit as the value of a field without a value', () => {
    const draft = createDraft([fieldConfig], {});

    insertCredit({
      draft,
      locale: 'en',
      target: { keyPath: 'body', fieldConfig, format: 'markdown' },
      credit: 'Photo by Melvin',
    });

    expect(updateFieldValue).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'Photo by Melvin' }),
    );
  });

  test('does nothing with an empty credit', () => {
    const draft = createDraft([fieldConfig], { en: { body: 'Hello' } });

    insertCredit({
      draft,
      locale: 'en',
      target: { keyPath: 'body', fieldConfig, format: 'markdown' },
      credit: ' \n ',
    });

    expect(updateFieldValue).not.toHaveBeenCalled();
  });
});

describe('getCreditCaptionKeyPath()', () => {
  afterEach(() => {
    customComponentRegistry.clear();
  });

  /**
   * Register a custom component with the given fields.
   * @param {string} name Component name.
   * @param {any[]} fields Fields.
   */
  const registerComponent = (name, fields) => {
    customComponentRegistry.set(
      name,
      /** @type {any} */ ({ id: name, label: name, fields, pattern: new RegExp(`^<${name}>$`) }),
    );
  };

  /**
   * Get the key path of the Caption field.
   * @param {string | undefined} componentName Component name.
   * @param {string} keyPath Key path of the file field.
   * @param {DraftValueStoreKey} [valueStoreKey] Value store key.
   * @returns {string | undefined} Key path.
   */
  const getKeyPath = (componentName, keyPath, valueStoreKey = 'extraValues') =>
    getCreditCaptionKeyPath({ valueStoreKey, componentName, keyPath });

  test('returns the Caption field of a built-in image component', () => {
    expect(getKeyPath('image', 'body:c12:src')).toBe('body:c12:caption');
    expect(getKeyPath('linked-image', 'body:c12:src')).toBe('body:c12:caption');
    // In a component nested in another
    expect(getKeyPath('image', 'body:c1:text:c2:src')).toBe('body:c1:text:c2:caption');
  });

  test('returns nothing for an uncaptioned image component', () => {
    expect(getKeyPath('uncaptioned-image', 'body:c12:src')).toBeUndefined();
    expect(getKeyPath('uncaptioned-linked-image', 'body:c12:src')).toBeUndefined();
  });

  test('returns the Caption field of a custom component', () => {
    registerComponent('figure', [
      { name: 'photo', widget: 'image' },
      { name: 'caption', widget: 'text' },
    ]);
    registerComponent('slide', [{ name: 'file', widget: 'file' }, { name: 'caption' }]);

    expect(getKeyPath('x-figure', 'body:c1:photo')).toBe('body:c1:caption');
    expect(getKeyPath('slide', 'body:c1:file')).toBe('body:c1:caption');
  });

  test('returns nothing for any other field', () => {
    registerComponent('locked', [
      { name: 'photo', widget: 'image' },
      { name: 'caption', readonly: true },
    ]);
    registerComponent('gallery', [
      { name: 'photo', widget: 'image' },
      { name: 'title' },
      { name: 'images', widget: 'list', fields: [{ name: 'src', widget: 'image' }] },
      { name: 'caption', widget: 'richtext' },
    ]);

    // Not in a component
    expect(getKeyPath('image', 'src', 'currentValues')).toBeUndefined();
    expect(getKeyPath(undefined, 'body:c12:src')).toBeUndefined();
    // An unknown component
    expect(getKeyPath('x-unknown', 'body:c12:src')).toBeUndefined();
    // Not the image field of the component
    expect(getKeyPath('image', 'body:c12:alt')).toBeUndefined();
    // A Caption field of another type, or one that can’t be edited
    expect(getKeyPath('gallery', 'body:c1:photo')).toBeUndefined();
    expect(getKeyPath('locked', 'body:c1:photo')).toBeUndefined();
    // A field nested in another field of the component
    expect(getKeyPath('gallery', 'body:c1:images.0.src')).toBeUndefined();
  });
});

describe('insertCreditCaption()', () => {
  test('sets the credits as the caption, on a single line', () => {
    const draft = /** @type {EntryDraft} */ (/** @type {unknown} */ ({ extraValues: {} }));

    insertCreditCaption({
      draft,
      locale: 'en',
      keyPath: 'body:c1:caption',
      credit: ` ${UNSPLASH_CREDIT} \n\nPhoto by Melvin`,
    });

    expect(draft.extraValues.en).toEqual({
      'body:c1:caption': `${UNSPLASH_CREDIT} Photo by Melvin`,
    });
  });

  test('adds the credits after an existing caption', () => {
    const draft = /** @type {EntryDraft} */ (
      /** @type {unknown} */ ({ extraValues: { en: { 'body:c1:caption': 'A cow. ' } } })
    );

    insertCreditCaption({ draft, locale: 'en', keyPath: 'body:c1:caption', credit: 'Photo by M' });
    expect(draft.extraValues.en['body:c1:caption']).toBe('A cow. Photo by M');
  });

  test('replaces a credit already in the caption', () => {
    const pexels = '<a href="https://www.pexels.com/photo/1/">Photo by Jo on Pexels</a>';
    const pixabay = '<a href="https://pixabay.com/photos/2/">Photo by Al on Pixabay</a>';

    [UNSPLASH_CREDIT, pexels, pixabay].forEach((oldCredit) => {
      const draft = /** @type {EntryDraft} */ (
        /** @type {unknown} */ ({
          extraValues: {
            en: { 'body:c1:caption': `Photo by me. A cow. ${oldCredit}  Taken 2024.` },
          },
        })
      );

      insertCreditCaption({ draft, locale: 'en', keyPath: 'body:c1:caption', credit: pexels });
      // The caption’s own text is kept, including a `Photo by` that isn’t a credit
      expect(draft.extraValues.en['body:c1:caption']).toBe(
        `Photo by me. A cow. Taken 2024. ${pexels}`,
      );
    });

    // A caption that is just a credit
    const draft = /** @type {EntryDraft} */ (
      /** @type {unknown} */ ({ extraValues: { en: { 'body:c1:caption': UNSPLASH_CREDIT } } })
    );

    insertCreditCaption({ draft, locale: 'en', keyPath: 'body:c1:caption', credit: pixabay });
    expect(draft.extraValues.en['body:c1:caption']).toBe(pixabay);
  });

  test('does nothing with an empty credit', () => {
    const draft = /** @type {EntryDraft} */ (
      /** @type {unknown} */ ({ extraValues: { en: { 'body:c1:caption': 'A cow.' } } })
    );

    insertCreditCaption({ draft, locale: 'en', keyPath: 'body:c1:caption', credit: '\n' });
    expect(draft.extraValues.en['body:c1:caption']).toBe('A cow.');
  });
});
