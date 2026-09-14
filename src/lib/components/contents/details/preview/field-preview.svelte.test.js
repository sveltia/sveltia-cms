import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { customFieldTypeRegistry } from '$lib/services/api/registries';
import { highlightEditorField } from '$lib/services/contents/editor/fields';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import FieldPreview from './field-preview.svelte';

/**
 * @import { Field } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/editor/fields', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  highlightEditorField: vi.fn(),
}));

/**
 * Render the preview of a field within a draft.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {Record<string, any>} [args.values] Flattened values in the current locale.
 * @param {string} [args.locale] Current locale.
 * @param {boolean} [args.i18nEnabled] Whether the collection has i18n enabled.
 * @param {boolean} [args.showLabel] Whether to show the label.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async ({
  fieldConfig,
  values = {},
  locale = 'en',
  i18nEnabled = false,
  showLabel = undefined,
}) => {
  const { container } = await renderWithDraft(FieldPreview, {
    draft: createMockDraft({
      fields: [fieldConfig],
      i18n: { i18nEnabled, defaultLocale: 'en', allLocales: i18nEnabled ? ['en', 'ja'] : ['en'] },
      values: { en: values, ...(i18nEnabled ? { ja: values } : {}) },
    }),
    props: {
      locale,
      keyPath: fieldConfig.name,
      typedKeyPath: fieldConfig.name,
      fieldConfig,
      showLabel,
    },
  });

  return container;
};

describe('FieldPreview', () => {
  test('renders the preview for the field type under its label', async () => {
    const container = await renderPreview({
      fieldConfig: { name: 'title', widget: 'string', label: 'Title' },
      values: { title: 'Hello' },
    });

    const section = container.querySelector('section');

    expect(section).toHaveAttribute('data-field-type', 'string');
    expect(section).toHaveAttribute('data-key-path', 'title');
    expect(section?.querySelector('h4')).toHaveTextContent('Title');
    expect(section?.querySelector('p')).toHaveTextContent('Hello');
  });

  test('falls back to the field name as the label, or hides it', async () => {
    expect(
      (await renderPreview({ fieldConfig: { name: 'title', widget: 'string' } })).querySelector(
        'h4',
      ),
    ).toHaveTextContent('title');
    expect(
      (
        await renderPreview({
          fieldConfig: { name: 'title', widget: 'string' },
          showLabel: false,
        })
      ).querySelector('h4'),
    ).toBeNull();
  });

  test('passes the items of a multi-value field', async () => {
    const container = await renderPreview({
      fieldConfig: { name: 'tags', widget: 'list' },
      values: { 'tags.0': 'a', 'tags.1': 'b' },
    });

    expect([...container.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['a', 'b']);
  });

  test('renders nothing for a hidden field or a field without preview', async () => {
    expect(
      (await renderPreview({ fieldConfig: { name: 'secret', widget: 'hidden' } })).children,
    ).toHaveLength(0);
    expect(
      (await renderPreview({ fieldConfig: { name: 'title', widget: 'string', preview: false } }))
        .children,
    ).toHaveLength(0);
  });

  test('renders a non-translatable field in the default locale only', async () => {
    /** @type {Field} */
    const fieldConfig = { name: 'title', widget: 'string', i18n: false };

    expect(
      (await renderPreview({ fieldConfig, locale: 'en', i18nEnabled: true })).children,
    ).toHaveLength(1);
    expect(
      (await renderPreview({ fieldConfig, locale: 'ja', i18nEnabled: true })).children,
    ).toHaveLength(0);
    expect(
      (
        await renderPreview({
          fieldConfig: { ...fieldConfig, i18n: 'duplicate' },
          locale: 'ja',
          i18nEnabled: true,
        })
      ).children,
    ).toHaveLength(1);
  });

  test('highlights the editor field when activated', async () => {
    const container = await renderPreview({
      fieldConfig: { name: 'title', widget: 'string' },
      values: { title: 'Hello' },
    });

    const section = page.elementLocator(
      /** @type {HTMLElement} */ (container.querySelector('section')),
    );

    await section.click();
    expect(highlightEditorField).toHaveBeenCalledWith({ locale: 'en', keyPath: 'title' });

    vi.mocked(highlightEditorField).mockClear();
    /** @type {HTMLElement} */ (container.querySelector('section')).focus();
    await page
      .getByRole('group')
      .element()
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(highlightEditorField).toHaveBeenCalledOnce();

    // Any other key is left alone
    await page
      .getByRole('group')
      .element()
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(highlightEditorField).toHaveBeenCalledOnce();
  });

  test('renders a custom field type with its own preview', async () => {
    const preview = vi.fn(({ value }) => `Custom: ${value}`);

    customFieldTypeRegistry.set('rating', /** @type {any} */ ({ preview }));

    try {
      const container = await renderPreview({
        fieldConfig: /** @type {any} */ ({ name: 'stars', widget: 'rating' }),
        values: { stars: 5 },
      });

      await vi.waitFor(() => expect(container).toHaveTextContent('stars Custom: 5'));

      // A custom field type without a preview shows nothing
      customFieldTypeRegistry.set('rating', /** @type {any} */ ({}));

      const another = await renderPreview({
        fieldConfig: /** @type {any} */ ({ name: 'stars', widget: 'rating' }),
        values: { stars: 5 },
      });

      await expect.poll(() => another.textContent?.trim()).toBe('stars');
    } finally {
      customFieldTypeRegistry.delete('rating');
    }
  });
});
