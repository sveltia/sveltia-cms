import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { globalAssetFolder } from '$lib/services/assets/folders';
import { env } from '$lib/services/user/env.svelte';
import { createMockAsset, createMockImageFile, initTestConfig, setAssets } from '$lib/test/config';
import { createMockDraft } from '$lib/test/draft';
import { renderFieldEditor } from '$lib/test/field.svelte';

import ObjectEditor from './object-editor.svelte';

/**
 * @import { ObjectField } from '$lib/types/public';
 */

vi.mock('$lib/services/user/env.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return { env: createState({ hasMouse: true }), initUserEnvDetection: vi.fn() };
});

/** @type {ObjectField} */
const authorField = {
  name: 'author',
  widget: 'object',
  label: 'Author',
  summary: '{{fields.name}}',
  fields: [
    { name: 'name', widget: 'string', default: 'Anonymous' },
    { name: 'email', widget: 'string' },
  ],
};

/** @type {ObjectField} */
const blockField = {
  name: 'block',
  widget: 'object',
  summary: 'Block: {{fields.type}}',
  types: [
    {
      name: 'hero',
      label: 'Hero',
      summary: 'Hero: {{fields.heading}}',
      fields: [{ name: 'heading', widget: 'string' }],
    },
    { name: 'quote', fields: [{ name: 'text', widget: 'text' }] },
  ],
};

/**
 * Render the editor within a draft.
 * @param {ObjectField} fieldConfig Field configuration.
 * @param {Record<string, any>} values Flattened values.
 * @param {object} [options] Options.
 * @param {string} [options.locale] Locale to edit. Any other locale than `_default` enables i18n.
 * @param {Record<string, any>} [options.props] Props to override.
 * @param {Record<string, any>} [options.context] Any other Svelte context.
 * @returns {Promise<{ draft: any, container: HTMLElement }>} Draft and container.
 */
const renderEditor = async (
  fieldConfig,
  values,
  { locale = '_default', props = {}, context = {} } = {},
) => {
  const i18n =
    locale === '_default'
      ? undefined
      : { i18nEnabled: true, defaultLocale: 'en', allLocales: ['en', 'fr'] };

  const draft = createMockDraft({
    fields: [fieldConfig],
    i18n,
    values: i18n ? { en: { ...values }, fr: { ...values } } : { _default: values },
  });

  const { container } = await renderFieldEditor(ObjectEditor, {
    fieldConfig,
    locale,
    props: { required: fieldConfig.required ?? true, ...props },
    draft,
    context,
  });

  return { draft, container };
};

/**
 * Get the flattened values of the object, without the placeholder.
 * @param {any} draft Draft.
 * @param {string} keyPath Key path of the object.
 * @returns {Record<string, any>} Values.
 */
const getStoredValues = (draft, keyPath) =>
  Object.fromEntries(
    Object.entries(draft.currentValues._default).filter(([key]) => key.startsWith(`${keyPath}.`)),
  );

describe('ObjectEditor', () => {
  test('edits each subfield', async () => {
    const { draft } = await renderEditor(authorField, {
      'author.name': 'Melvin',
      'author.email': 'melvin@example.com',
    });

    const name = page.getByRole('group', { name: /name/ }).getByRole('textbox');

    await expect.element(name).toHaveValue('Melvin');
    await name.fill('Elsie');
    await expect.poll(() => draft.currentValues._default['author.name']).toBe('Elsie');
  });

  test('collapses to a summary and remembers the state in the draft', async () => {
    const { draft, container } = await renderEditor(authorField, { 'author.name': 'Melvin' });

    await page.getByRole('button', { name: 'Collapse' }).click();

    await expect.poll(() => draft.expanderStates._['author#']).toBe(false);
    expect(page.getByRole('textbox').elements()).toHaveLength(0);
    expect(container.querySelector('.summary')).toHaveTextContent('Melvin');

    await page.getByRole('button', { name: 'Expand' }).click();
    await expect.poll(() => draft.expanderStates._['author#']).toBe(true);
    expect(page.getByRole('textbox').elements()).toHaveLength(2);
  });

  test('is labelled by its summary only while one is shown', async () => {
    await renderEditor(authorField, { 'author.name': 'Melvin' });

    const group = page.getByRole('group').first();

    await expect.element(group).not.toHaveAttribute('aria-labelledby');
    await page.getByRole('button', { name: 'Collapse' }).click();
    await expect.element(page.getByRole('group', { name: 'Melvin' })).toBeInTheDocument();
  });

  test('isn’t labelled by a summary that isn’t shown for a collapsed object', async () => {
    const { container } = await renderEditor(
      { ...authorField, collapsed: true },
      { 'author.name': '', 'author.email': '' },
    );

    await expect.element(page.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
    expect(container.querySelector('.summary')).toBeNull();
    expect(container.querySelector('.wrapper')).not.toHaveAttribute('aria-labelledby');
  });

  test('starts collapsed when configured so', async () => {
    const { draft } = await renderEditor({ ...authorField, collapsed: true }, {});

    await expect.poll(() => draft.expanderStates._['author#']).toBe(false);
  });

  test('adds and removes an optional object', async () => {
    const { draft } = await renderEditor({ ...authorField, required: false }, {});
    const checkbox = page.getByRole('checkbox', { name: /Add\W+Author/ });

    await expect.element(checkbox).not.toBeChecked();
    expect(page.getByRole('textbox').elements()).toHaveLength(0);

    await checkbox.click();
    await expect
      .poll(() => getStoredValues(draft, 'author'))
      .toEqual({
        'author.name': 'Anonymous',
        'author.email': '',
      });
    await expect
      .element(page.getByRole('group', { name: /name/ }).getByRole('textbox'))
      .toHaveValue('Anonymous');

    await checkbox.click();
    await expect.poll(() => getStoredValues(draft, 'author')).toEqual({});
    // A placeholder enables validation
    expect(draft.currentValues._default.author).toBe(null);

    // The checkbox falls back to the field name
    await renderEditor(
      { ...authorField, label: undefined, required: false },
      {},
      { props: { fieldLabel: '' } },
    );
    await expect.element(page.getByRole('checkbox', { name: /Add\W+author/ })).toBeVisible();
  });

  test('passes the typed key path on to the subfields', async () => {
    const { container } = await renderEditor(
      authorField,
      { 'author.name': 'Melvin' },
      { props: { typedKeyPath: 'posts.*.author' } },
    );

    // The typed key path locates a field-level media folder, so a list index must not end up in it
    expect(container.querySelector('[data-key-path="author.name"]')).toHaveAttribute(
      'data-typed-key-path',
      'posts.*.author.name',
    );
  });

  test('picks a type for an object with variable types', async () => {
    const { draft } = await renderEditor(blockField, {});

    await page.getByRole('button', { name: /Add\W+block/ }).click();
    await page.getByRole('menuitem', { name: 'Hero' }).click();

    await expect
      .poll(() => getStoredValues(draft, 'block'))
      .toEqual({
        'block.type': 'hero',
        'block.heading': '',
      });
    await expect
      .element(page.getByRole('button', { name: 'Collapse' }))
      .toHaveTextContent('expand_more Hero');

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => getStoredValues(draft, 'block')).toEqual({});
  });

  test('keeps the focus in the field as a type is picked and removed', async () => {
    await renderEditor(blockField, {});

    await page.getByRole('button', { name: /Add\W+block/ }).click();
    await page.getByRole('menuitem', { name: 'Hero' }).click();

    // The Add button is gone, so the expander of the object takes the focus
    await expect.element(page.getByRole('button', { name: 'Collapse' })).toHaveFocus();
    // It stays there once the menu has closed
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull();
    await expect.element(page.getByRole('button', { name: 'Collapse' })).toHaveFocus();

    // The Remove button is gone along with the object, so the Add button takes the focus
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect.element(page.getByRole('button', { name: /Add\W+block/ })).toHaveFocus();
  });

  test('picks a type without a header within a single-subfield list', async () => {
    const { draft } = await renderEditor(
      blockField,
      {},
      {
        context: {
          'field-editor': { fieldContext: 'single-subfield-list-field', parentComponentNames: [] },
        },
      },
    );

    await page.getByRole('button', { name: /Add\W+block/ }).click();
    await page.getByRole('menuitem', { name: 'Hero' }).click();
    await expect.poll(() => getStoredValues(draft, 'block')['block.type']).toBe('hero');
    await expect.element(page.getByRole('textbox', { name: 'heading' })).toBeVisible();
  });

  test('summarizes a typed object with the type’s summary, or the field’s', async () => {
    const { container } = await renderEditor(blockField, {
      'block.type': 'hero',
      'block.heading': 'Welcome',
    });

    await page.getByRole('button', { name: 'Collapse' }).click();
    await expect
      .poll(() => container.querySelector('.summary')?.textContent)
      .toContain('Hero: Welcome');

    // A type without a summary falls back to the field’s one; a small screen gets more lines
    env.isSmallScreen = true;

    try {
      const { container: quote } = await renderEditor(blockField, {
        'block.type': 'quote',
        'block.text': 'Hi',
      });

      await page.elementLocator(quote).getByRole('button', { name: 'Collapse' }).click();
      await expect
        .poll(() => quote.querySelector('.summary')?.textContent)
        .toContain('Block: quote');
    } finally {
      env.isSmallScreen = false;
    }
  });

  test('can’t add or remove an object when read-only', async () => {
    await renderEditor({ ...authorField, required: false }, {}, { props: { readonly: true } });

    await expect.element(page.getByRole('checkbox', { name: /Add\W+Author/ })).toBeDisabled();
  });

  test('copies the default locale values when adding an object in another locale', async () => {
    /** @type {ObjectField} */
    const field = {
      ...authorField,
      required: false,
      i18n: true,
      fields: [
        { name: 'name', widget: 'string', i18n: true },
        { name: 'age', widget: 'number', i18n: true },
      ],
    };

    // The subfields are looked up in the site configuration
    await initTestConfig({
      i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
      collections: [
        { name: 'posts', label: 'Posts', folder: 'content/posts', i18n: true, fields: [field] },
      ],
    });

    const { draft } = await renderEditor(field, {}, { locale: 'fr' });

    draft.currentValues.en['author.name'] = 'Melvin';
    draft.currentValues.en['author.age'] = 42;
    expect({ ...draft.currentValues.fr }).toEqual({});

    await page.getByRole('checkbox', { name: /Add\W+Author/ }).click();

    // A text value is left for translation, while the rest is copied
    await expect
      .poll(() => ({ ...draft.currentValues.fr }))
      .toEqual({ 'author.name': '', 'author.age': 42 });
  });

  test('is read-only in a locale whose values follow the default locale', async () => {
    // Whether a subfield is shown in the locale is looked up in the site configuration
    await initTestConfig({
      i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          i18n: true,
          fields: [
            {
              ...authorField,
              i18n: 'duplicate',
              fields: authorField.fields.map((field) => ({ ...field, i18n: 'duplicate' })),
            },
          ],
        },
      ],
    });

    const { container } = await renderEditor(
      {
        ...authorField,
        i18n: 'duplicate',
        fields: authorField.fields.map((field) => ({ ...field, i18n: 'duplicate' })),
      },
      { 'author.name': 'Melvin', 'author.email': '' },
      { locale: 'fr' },
    );

    const name = page.getByRole('textbox', { name: 'name' });

    await expect.element(name).toHaveValue('Melvin');
    await expect.element(name).toHaveAttribute('aria-readonly', 'true');
    expect(container.querySelector('.wrapper')).not.toBeNull();
  });

  test('is read-only in a locale where its parent duplicates the default locale values', async () => {
    /** @type {ObjectField} */
    const parentField = {
      name: 'outer',
      widget: 'object',
      i18n: 'duplicate',
      fields: [{ ...authorField, required: false }],
    };

    // The parent field is looked up in the site configuration
    await initTestConfig({
      i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          i18n: true,
          fields: [parentField],
        },
      ],
    });

    const { container } = await renderEditor(
      { ...authorField, required: false },
      { 'outer.author.name': 'Melvin', 'outer.author.email': '' },
      {
        locale: 'fr',
        props: { keyPath: 'outer.author', typedKeyPath: 'outer.author' },
      },
    );

    // The values are shown, like those of a subfield with its own `duplicate` option
    await expect.poll(() => container.querySelector('.wrapper')).not.toBeNull();
    await expect.element(page.getByRole('textbox', { name: 'name' })).toHaveValue('Melvin');
    await expect
      .element(page.getByRole('textbox', { name: 'name' }))
      .toHaveAttribute('aria-readonly', 'true');
  });

  test('hides the header within a single-subfield list', async () => {
    const { container } = await renderEditor(
      authorField,
      { 'author.name': 'Melvin', 'author.email': '' },
      {
        context: {
          'field-editor': { fieldContext: 'single-subfield-list-field', parentComponentNames: [] },
        },
      },
    );

    await expect.element(page.getByRole('textbox', { name: 'name' })).toHaveValue('Melvin');
    expect(container.querySelector('.wrapper > header')).toBeNull();
  });

  test('warns about a missing type key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await renderEditor(blockField, { 'block.heading': 'Hi' });

      await expect.element(page.getByRole('alert')).toBeVisible();
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^Object field block: The type key is not found in the object/),
      );
    } finally {
      warn.mockRestore();
    }
  });

  test('warns about an unknown type', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const { draft, container } = await renderEditor(blockField, { 'block.type': 'video' });

      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          'warning Warning This item can’t be displayed due to an unknown type. Check the browser console for details.',
        );
      expect(container.querySelector('.wrapper')).toHaveClass('unknown-type');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('“video” type is not defined'));

      // There are no subfields to collapse
      await page.getByRole('button', { name: 'Collapse' }).click();
      await expect.element(page.getByRole('alert')).toBeVisible();
      expect(draft.expanderStates._['block#']).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  test('isn’t labelled by a summary while collapsed with an unknown type', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const { draft, container } = await renderEditor(
        { ...blockField, collapsed: true },
        { 'block.type': 'video' },
      );

      await expect.poll(() => draft.expanderStates._['block#']).toBe(false);
      await expect.element(page.getByRole('alert')).toBeVisible();
      expect(container.querySelector('.wrapper')).not.toHaveAttribute('aria-labelledby');
    } finally {
      warn.mockRestore();
    }
  });

  /** @type {ObjectField} */
  const heroField = {
    name: 'hero',
    widget: 'object',
    summary: '{{fields.caption}}',
    thumbnail: 'media',
    fields: [
      { name: 'media', widget: 'file' },
      { name: 'caption', widget: 'string' },
    ],
  };

  /**
   * Load the site configuration and assets the thumbnail is looked up in.
   */
  const initThumbnailConfig = async () => {
    await initTestConfig({
      collections: [
        { name: 'posts', label: 'Posts', folder: 'content/posts', fields: [heroField] },
      ],
    });
    setAssets([
      createMockAsset({
        name: 'photo.png',
        file: await createMockImageFile(),
        asset: { folder: globalAssetFolder.current },
      }),
      createMockAsset({ name: 'notes.docx', asset: { folder: globalAssetFolder.current } }),
    ]);
  };

  test('shows the thumbnail of a collapsed object', async () => {
    await initThumbnailConfig();

    const { draft, container } = await renderEditor(heroField, {
      'hero.media': '/static/uploads/photo.png',
      'hero.caption': 'A photo',
    });

    await page.getByRole('button', { name: 'Collapse' }).click();
    await expect.poll(() => draft.expanderStates._['hero#']).toBe(false);
    await expect
      .poll(() => container.querySelector('.summary img')?.getAttribute('src'))
      .toMatch(/^blob:/);
    expect(container.querySelector('.summary')).toHaveTextContent('A photo');
  });

  test('shows the thumbnail without a summary', async () => {
    await initThumbnailConfig();

    const { draft, container } = await renderEditor(
      { ...heroField, summary: undefined },
      { 'hero.media': '/static/uploads/photo.png', 'hero.caption': '' },
    );

    await page.getByRole('button', { name: 'Collapse' }).click();
    await expect.poll(() => draft.expanderStates._['hero#']).toBe(false);
    await expect
      .poll(() => container.querySelector('.summary img')?.getAttribute('src'))
      .toMatch(/^blob:/);
  });

  test('shows no thumbnail for a file that has none', async () => {
    await initThumbnailConfig();

    const { draft, container } = await renderEditor(heroField, {
      'hero.media': '/static/uploads/notes.docx',
      'hero.caption': 'Notes',
    });

    await page.getByRole('button', { name: 'Collapse' }).click();
    await expect.poll(() => draft.expanderStates._['hero#']).toBe(false);
    expect(container.querySelector('.summary')).toHaveTextContent('Notes');
    expect(container.querySelector('.summary img')).toBeNull();
  });
});
