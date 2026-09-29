import { createElement } from 'react';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { customFieldTypeRegistry } from '$lib/services/api/registries';
import { initTestConfig } from '$lib/test/config';
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

  test('marks an optional field without showing its comment', async () => {
    const { container } = await renderEditor({
      fieldConfig: { name: 'title', widget: 'string', required: false, comment: 'Optional' },
    });

    expect(container.querySelector('.required')).toBeNull();
    // Like Netlify/Decap CMS, a comment is written to the YAML file rather than shown in the UI
    expect(container).not.toHaveTextContent('Optional');
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

  test('clears a field with multiple inputs from the field options', async () => {
    const { draft } = await renderEditor({
      fieldConfig: { name: 'tags', widget: 'list' },
      values: { 'tags.0': 'a', 'tags.1': 'b' },
    });

    const optionsButton = page.getByRole('button', { name: 'Show Field Options' });

    await optionsButton.click();
    await page.getByRole('menuitem', { name: 'Clear' }).click();
    await expect.poll(() => draft.currentValues.en).toEqual({ tags: [] });
    await expect.element(page.getByRole('textbox')).toHaveValue('');

    // There’s nothing left to clear, but the change can be reverted
    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await optionsButton.click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Clear' }))
      .toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'false');
  });

  test('clears a KeyValue field, leaving a blank row', async () => {
    const { draft } = await renderEditor({
      fieldConfig: { name: 'meta', widget: 'keyvalue' },
      values: { 'meta.a': '1', 'meta.b': '2' },
    });

    await page.getByRole('button', { name: 'Show Field Options' }).click();
    await page.getByRole('menuitem', { name: 'Clear' }).click();

    await expect.poll(() => draft.currentValues.en).toEqual({ meta: null });
    await expect.element(page.getByRole('textbox', { name: 'Key' })).toHaveValue('');
    await expect.element(page.getByRole('textbox', { name: 'Value' })).toHaveValue('');
  });

  test('restores the default value of a field from the field options', async () => {
    const { draft } = await renderEditor({
      fieldConfig: { name: 'title', widget: 'string', default: 'Untitled' },
      values: { title: 'Hi' },
    });

    const optionsButton = page.getByRole('button', { name: 'Show Field Options' });

    await optionsButton.click();
    // Every field can be cleared as well, with no separator above the items when nothing precedes
    await expect.element(page.getByRole('menuitem', { name: 'Clear' })).toBeVisible();
    expect(document.querySelectorAll('[role="menu"] [role="separator"]')).toHaveLength(0);
    await page.getByRole('menuitem', { name: 'Restore Default' }).click();
    await expect.poll(() => draft.currentValues.en.title).toBe('Untitled');

    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await optionsButton.click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Restore Default' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('doesn’t offer to clear a KeyValue field whose keys follow the default locale', async () => {
    await renderEditor({
      fieldConfig: { name: 'meta', widget: 'keyvalue', i18n: 'duplicate_keys' },
      locale: 'ja',
      i18nEnabled: true,
    });

    await page.getByRole('button', { name: 'Show Field Options' }).click();
    await expect.element(page.getByRole('menuitem', { name: 'Revert Changes' })).toBeVisible();
    expect(page.getByRole('menuitem', { name: 'Clear' }).elements()).toHaveLength(0);
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

  test('locks every field of a read-only entry', async () => {
    const fieldConfig = { name: 'title', widget: 'string', i18n: true };

    const draft = createMockDraft({
      fields: [fieldConfig],
      i18n: { i18nEnabled: true, defaultLocale: 'en', allLocales: ['en', 'ja'] },
      values: { en: { title: 'Hello' }, ja: {} },
    });

    // The collection is a static property of the draft, so the flag is set on the object itself
    /** @type {any} */ (draft.collection).readonly = true;

    await renderWithDraft(FieldEditor, {
      draft,
      props: { locale: 'en', keyPath: 'title', typedKeyPath: 'title', fieldConfig },
    });

    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true');
    // Nothing can be translated, copied or reverted
    expect(page.getByRole('button', { name: /Translate/ }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Show Field Options' }).elements()).toHaveLength(0);
  });

  test('locks a UUID field unless the `readonly` option unlocks it', async () => {
    await renderEditor({
      fieldConfig: { name: 'id', widget: 'uuid' },
      values: { id: 'abc' },
    });

    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true');

    const { container } = await renderEditor({
      fieldConfig: { name: 'key', widget: 'uuid', readonly: false },
      values: { key: 'def' },
    });

    await expect
      .element(/** @type {HTMLElement} */ (container.querySelector('[role="textbox"], input')))
      .not.toHaveAttribute('aria-readonly', 'true');
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

  test('hides a DateTime field set automatically on save while the entry is new', async () => {
    const { container } = await renderEditor({
      fieldConfig: { name: 'updated', widget: 'datetime', auto_now: true },
      values: { updated: '' },
    });

    expect(container.querySelector('section')).toHaveAttribute('hidden');
  });

  test('shows a DateTime field set automatically on save as text once saved', async () => {
    const { container } = await renderEditor({
      fieldConfig: {
        name: 'created',
        label: 'Created',
        widget: 'datetime',
        input_timezone: 'utc',
        auto_now: ['create'],
      },
      values: { created: '2026-09-28T12:34:56Z' },
      draft: { isNew: false },
    });

    const group = page.getByRole('group', { name: /“.Created.” Field/ });

    await expect.element(group).toBeVisible();
    await expect.element(group).toMatchTextContent('Sep 28, 2026, 12:34 PM — UTC');
    expect(container.querySelector('input')).toBeNull();
    // Nothing to fill in, so it isn’t marked as required
    expect(container.querySelector('.required')).toBeNull();
  });

  test('ignores `auto_now` on a DateTime field in a rich text editor component', async () => {
    const draft = createMockDraft({
      fields: [{ name: 'body', widget: 'richtext' }],
      i18n: { i18nEnabled: false, defaultLocale: 'en', allLocales: ['en'] },
      values: { en: {} },
    });

    await renderWithDraft(FieldEditor, {
      draft,
      props: {
        locale: 'en',
        keyPath: 'published',
        typedKeyPath: 'published',
        fieldConfig: { name: 'published', label: 'Published', widget: 'datetime', auto_now: true },
        context: 'rich-text-editor-component',
      },
    });

    // The field isn’t set on save there, so it stays an editable input, shown even in a new entry
    await expect.element(page.getByRole('textbox')).toBeVisible();
    await expect.element(page.getByRole('textbox')).not.toHaveAttribute('aria-readonly', 'true');
  });

  test('warns about an unsupported field type', async () => {
    await renderEditor({
      fieldConfig: /** @type {any} */ ({ name: 'stars', widget: 'rating' }),
    });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('warning Warning Unsupported field type: \u2068rating\u2069');
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

  test('compares the subfields of an object field to tell whether it has changed', async () => {
    const { draft } = await renderEditor({
      fieldConfig: {
        name: 'author',
        widget: 'object',
        label: 'Author',
        fields: [{ name: 'name', widget: 'string', label: 'Name' }],
      },
      values: { 'author.name': 'Alice' },
    });

    const optionsButton = page
      .getByRole('group', { name: /“.Author.” Field/ })
      .getByRole('button', { name: 'Show Field Options' })
      .first();

    await optionsButton.click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert Changes' }))
      .toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');

    await page.getByRole('textbox').fill('Bob');
    await expect.poll(() => draft.currentValues.en['author.name']).toBe('Bob');
    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await optionsButton.click();
    await page.getByRole('menuitem', { name: 'Revert Changes' }).click();

    await expect.poll(() => draft.currentValues.en['author.name']).toBe('Alice');
    await expect.element(page.getByRole('textbox')).toHaveValue('Alice');
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

describe('FieldEditor (nested in a duplicated field)', () => {
  /** @type {Field} */
  const venueField = {
    name: 'venue',
    widget: 'object',
    i18n: 'duplicate',
    fields: [
      { name: 'name', widget: 'string' },
      { name: 'note', widget: 'string', i18n: true },
    ],
  };

  beforeAll(async () => {
    // The ancestors of a subfield are looked up in the configuration
    await initTestConfig({
      i18n: { structure: 'multiple_files', locales: ['en', 'ja'], default_locale: 'en' },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          i18n: true,
          fields: [venueField],
        },
      ],
    });
  });

  /**
   * Render the editor of a subfield of the Venue field in Japanese.
   * @param {Field} fieldConfig Subfield configuration.
   * @returns {Promise<void>}
   */
  const renderSubField = async (fieldConfig) => {
    const draft = createMockDraft({
      fields: [venueField],
      i18n: { i18nEnabled: true, defaultLocale: 'en', allLocales: ['en', 'ja'] },
      values: {
        en: { 'venue.name': 'Hall', 'venue.note': 'Big' },
        ja: { 'venue.name': 'Hall', 'venue.note': '大' },
      },
    });

    const keyPath = `venue.${fieldConfig.name}`;

    await renderWithDraft(FieldEditor, {
      draft,
      props: { locale: 'ja', keyPath, typedKeyPath: keyPath, fieldConfig },
    });
  };

  test('shows a subfield duplicated along with its ancestor read-only in another locale', async () => {
    await renderSubField(venueField.fields[0]);

    // Rather than hiding it, which would leave the Object field empty there
    await expect.element(page.getByRole('textbox')).toHaveValue('Hall');
    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true');
    expect(page.getByRole('button', { name: 'Show Field Options' }).elements()).toHaveLength(0);
  });

  test('locks a duplicated subfield of a rich text editor component in another locale', async () => {
    const draft = createMockDraft({
      fields: [venueField],
      i18n: { i18nEnabled: true, defaultLocale: 'en', allLocales: ['en', 'ja'] },
      values: { en: {}, ja: {} },
    });

    // A component’s subfield isn’t one of the entry’s fields, so only its own option counts
    await renderWithDraft(FieldEditor, {
      draft,
      props: {
        locale: 'ja',
        keyPath: 'caption',
        typedKeyPath: 'caption',
        fieldConfig: { name: 'caption', widget: 'string', i18n: 'duplicate' },
        context: 'rich-text-editor-component',
      },
    });

    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true');
  });

  test('lets a subfield with its own translatable option be edited in another locale', async () => {
    await renderSubField(venueField.fields[1]);

    await expect.element(page.getByRole('textbox')).toHaveValue('大');
    await expect.element(page.getByRole('textbox')).not.toHaveAttribute('aria-readonly', 'true');
  });
});
