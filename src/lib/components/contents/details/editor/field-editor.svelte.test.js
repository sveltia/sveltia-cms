import { sleep } from '@sveltia/utils/misc';
import { createElement } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { customFieldTypeRegistry } from '$lib/services/api/registries';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import FieldEditor from './field-editor.svelte';

/**
 * @import { EntryDraft } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Render the editor of a field within a draft.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {Record<string, any>} [args.values] Flattened values in the current locale.
 * @param {string} [args.locale] Current locale.
 * @param {boolean} [args.i18nEnabled] Whether the collection has i18n enabled.
 * @param {string[]} [args.locales] Locales, when i18n is enabled.
 * @param {Partial<EntryDraft>} [args.draft] Extra draft properties.
 * @returns {Promise<{ container: HTMLElement, draft: any }>} Container and draft.
 */
const renderEditor = async ({
  fieldConfig,
  values = {},
  locale = 'en',
  i18nEnabled = false,
  locales = ['en', 'ja'],
  draft: draftProps = {},
}) => {
  const allLocales = i18nEnabled ? locales : ['en'];

  const draft = createMockDraft({
    fields: [fieldConfig],
    i18n: { i18nEnabled, defaultLocale: 'en', allLocales },
    values: Object.fromEntries(allLocales.map((l) => [l, l === 'en' ? values : {}])),
    draft: draftProps,
  });

  const { container } = await renderWithDraft(FieldEditor, {
    draft,
    props: { locale, keyPath: fieldConfig.name, typedKeyPath: fieldConfig.name, fieldConfig },
  });

  return { container, draft };
};

describe('FieldEditor', () => {
  test('renders the editor for the field type under a labelled header', async () => {
    const { container } = await renderEditor({
      fieldConfig: { name: 'title', widget: 'string', label: 'Title', hint: 'Keep it *short*' },
      values: { title: 'Hello' },
    });

    const group = page.getByRole('group', { name: /“.Title.” Field/ });

    await expect.element(group).toHaveAttribute('data-field-type', 'string');
    await expect.element(group).toHaveAttribute('data-key-path', 'title');
    await expect.element(group.getByRole('textbox')).toHaveValue('Hello');
    await expect
      .element(group.getByRole('textbox'))
      .toHaveAttribute('aria-labelledby', container.querySelector('h4')?.id ?? '');
    expect(container.querySelector('h4')).toHaveTextContent('Title');
    expect(container.querySelector('.required')).toHaveTextContent('*');
    expect(container.querySelector('.hint')?.innerHTML).toBe('Keep it <em>short</em>');
  });

  test('writes an edited value to the draft', async () => {
    const { draft } = await renderEditor({
      fieldConfig: { name: 'title', widget: 'string' },
      values: { title: 'Hello' },
    });

    await page.getByRole('textbox').fill('Hi');

    await expect.poll(() => draft.currentValues.en.title).toBe('Hi');
  });

  test('marks an optional field and shows a comment', async () => {
    const { container } = await renderEditor({
      fieldConfig: { name: 'title', widget: 'string', required: false, comment: 'Optional' },
    });

    expect(container.querySelector('.required')).toBeNull();
    expect(container.querySelector('.comment')).toHaveTextContent('Optional');
    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-required', 'false');
  });

  test('shows the prefix, suffix and extra labels around the input', async () => {
    const { container } = await renderEditor({
      fieldConfig: {
        name: 'handle',
        widget: 'string',
        prefix: '@',
        suffix: '.eth',
        before_input: 'Owner:',
        after_input: '(ENS)',
      },
    });

    expect(container.querySelector('.before-input')).toHaveTextContent('Owner:');
    expect(container.querySelector('.prefix')).toHaveTextContent('@');
    expect(container.querySelector('.suffix')).toHaveTextContent('.eth');
    expect(container.querySelector('.after-input')).toHaveTextContent('(ENS)');
    expect(container.querySelector('.field-wrapper')).toHaveClass('has-extra-labels');
  });

  test('shows a validation error', async () => {
    const { container } = await renderEditor({
      fieldConfig: { name: 'title', widget: 'string' },
      draft: {
        validities: { en: { title: { valid: false, valueMissing: true } } },
        validationMessages: { en: { title: ['This field is required.'] } },
      },
    });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error This field is required.');
    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    await expect
      .element(page.getByRole('textbox'))
      .toHaveAttribute('aria-errormessage', container.querySelector('[role="alert"]')?.id ?? '');
  });

  test('reverts the changes from the field options', async () => {
    const { draft } = await renderEditor({
      fieldConfig: { name: 'title', widget: 'string' },
      values: { title: 'Hello' },
    });

    const optionsButton = page.getByRole('button', { name: 'Show Field Options' });

    await optionsButton.click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
    await page.getByRole('textbox').fill('Hi');
    await expect.poll(() => draft.currentValues.en.title).toBe('Hi');

    await optionsButton.click();
    await page.getByRole('menuitem', { name: 'Revert Changes' }).click();

    await expect.poll(() => draft.currentValues.en.title).toBe('Hello');
    await expect.element(page.getByRole('textbox')).toHaveValue('Hello');
  });

  test('renders nothing for a hidden field or a non-translatable field in another locale', async () => {
    expect(
      (await renderEditor({ fieldConfig: { name: 'secret', widget: 'hidden' } })).container
        .children,
    ).toHaveLength(0);
    expect(
      (
        await renderEditor({
          fieldConfig: { name: 'title', widget: 'string', i18n: false },
          locale: 'ja',
          i18nEnabled: true,
        })
      ).container.children,
    ).toHaveLength(0);
  });

  test('locks a field duplicated from the default locale', async () => {
    await renderEditor({
      fieldConfig: { name: 'title', widget: 'string', i18n: 'duplicate' },
      locale: 'ja',
      i18nEnabled: true,
    });

    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true');
    // Nothing can be copied or reverted
    expect(page.getByRole('button', { name: 'Show Field Options' }).elements()).toHaveLength(0);
  });

  test('compares against nothing in a locale that was enabled later', async () => {
    // The original values only cover the locales enabled when the draft was created
    const draft = { originalValues: { en: {} } };

    await renderEditor({
      fieldConfig: { name: 'title', widget: 'string', i18n: true },
      locale: 'ja',
      i18nEnabled: true,
      draft,
    });

    const optionsButton = page.getByRole('button', { name: 'Show Field Options' });

    await optionsButton.click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'false');
    await userEvent.keyboard('{Escape}');

    await renderEditor({
      fieldConfig: { name: 'tags', widget: 'list', i18n: true },
      locale: 'ja',
      i18nEnabled: true,
      draft,
    });
    await optionsButton.nth(1).click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');

    await renderEditor({
      fieldConfig: {
        name: 'colors',
        widget: 'select',
        multiple: true,
        options: ['red'],
        i18n: true,
      },
      locale: 'ja',
      i18nEnabled: true,
      draft,
    });
    await optionsButton.nth(2).click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('hides the compute field but keeps it in the DOM', async () => {
    const { container } = await renderEditor({
      fieldConfig: { name: 'slug', widget: 'compute', value: '{{title}}' },
    });

    expect(container.querySelector('section')).toHaveAttribute('hidden');
  });

  test('warns about an unsupported field type', async () => {
    await renderEditor({
      fieldConfig: /** @type {any} */ ({ name: 'stars', widget: 'rating' }),
    });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('warning Unsupported field type: \u2068rating\u2069');
  });

  test('offers to copy a translatable field from the other locales', async () => {
    await renderEditor({
      fieldConfig: { name: 'title', widget: 'string', i18n: true },
      locale: 'ja',
      i18nEnabled: true,
      values: { title: 'Hello' },
    });

    await page.getByRole('button', { name: 'Show Field Options' }).click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Copy from \u2068English\u2069' }))
      .toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    // The locales are grouped in a submenu when there are several
    await renderEditor({
      fieldConfig: { name: 'title', widget: 'string', i18n: true },
      locale: 'ja',
      i18nEnabled: true,
      locales: ['en', 'ja', 'fr'],
      values: { title: 'Hello' },
    });

    await page.getByRole('button', { name: 'Show Field Options' }).nth(1).click();

    const parent = page.getByRole('menuitem', { name: 'Copy from…' });

    await expect.element(parent).toBeInTheDocument();
    await sleep(150);
    await parent.click();
    await expect.element(page.getByRole('menuitem', { name: 'English' })).toBeInTheDocument();
  });

  test('compares the items of a list field to tell whether it has changed', async () => {
    const { draft } = await renderEditor({
      fieldConfig: { name: 'tags', widget: 'list' },
      values: { 'tags.0': 'a', 'tags.1': 'b' },
    });

    await page.getByRole('button', { name: 'Show Field Options' }).click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');

    draft.currentValues.en['tags.1'] = 'c';
    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await page.getByRole('button', { name: 'Show Field Options' }).click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'false');
  });

  test('renders a custom field type with its own control', async () => {
    const control = vi.fn(({ value, forID }) =>
      createElement('input', { id: forID, value: value ?? '', readOnly: true }),
    );

    customFieldTypeRegistry.set('rating', /** @type {any} */ ({ control }));

    try {
      await renderEditor({
        fieldConfig: { name: 'stars', widget: 'rating' },
        values: { stars: 3 },
      });

      await expect.element(page.getByRole('textbox')).toHaveValue('3');
      // The comparison with the original value uses the custom value as well
      await page.getByRole('button', { name: 'Show Field Options' }).click();
      await expect
        .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
        .toHaveAttribute('aria-disabled', 'true');
    } finally {
      customFieldTypeRegistry.delete('rating');
    }
  });

  test('compares the values of a multiple select field to tell whether it has changed', async () => {
    const { draft } = await renderEditor({
      fieldConfig: { name: 'tags', widget: 'select', multiple: true, options: ['a', 'b', 'c'] },
      values: { 'tags.0': 'a' },
    });

    await page.getByRole('button', { name: 'Show Field Options' }).click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');

    draft.currentValues.en['tags.1'] = 'b';
    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await page.getByRole('button', { name: 'Show Field Options' }).click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'false');
  });
});
