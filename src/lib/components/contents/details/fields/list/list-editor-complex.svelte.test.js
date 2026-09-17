import { sleep } from '@sveltia/utils/misc';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { globalAssetFolder } from '$lib/services/assets/folders';
import { env } from '$lib/services/user/env.svelte';
import { createMockAsset, createMockImageFile, initTestConfig, setAssets } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ListEditorComplex from './list-editor-complex.svelte';

/**
 * @import { ComplexListField } from '$lib/types/public';
 */

vi.mock('$lib/services/user/env.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return { env: createState({ hasMouse: true }), initUserEnvDetection: vi.fn() };
});

/** @type {ComplexListField} */
const authorsField = {
  name: 'authors',
  widget: 'list',
  label: 'Authors',
  label_singular: 'Author',
  summary: '{{fields.name}}',
  fields: [
    { name: 'name', widget: 'string', default: 'Anonymous' },
    { name: 'role', widget: 'string' },
  ],
};

/** @type {ComplexListField} */
const sectionsField = {
  name: 'sections',
  widget: 'list',
  types: [
    { name: 'hero', label: 'Hero', fields: [{ name: 'heading', widget: 'string' }] },
    { name: 'quote', fields: [{ name: 'text', widget: 'text' }] },
  ],
};

/**
 * Render the editor within a draft.
 * @param {ComplexListField} fieldConfig Field configuration.
 * @param {Record<string, any>} values Flattened values.
 * @returns {Promise<{ draft: any, container: HTMLElement, entryDraft: any }>} Draft, container
 * and draft state.
 */
const renderEditor = async (fieldConfig, values) => {
  const draft = createMockDraft({ fields: [fieldConfig], values: { _default: values } });

  const { container, entryDraft } = await renderWithDraft(ListEditorComplex, {
    draft,
    props: {
      locale: '_default',
      keyPath: fieldConfig.name,
      typedKeyPath: fieldConfig.name,
      fieldId: fieldConfig.name,
      fieldLabel: fieldConfig.label ?? fieldConfig.name,
      fieldConfig,
    },
  });

  return { draft, container, entryDraft };
};

/**
 * Get the list items stored in the draft, unflattened.
 * @param {any} draft Draft.
 * @param {string} keyPath Key path of the list.
 * @returns {Record<string, any>[]} Items.
 */
const getStoredItems = (draft, keyPath) => {
  /** @type {Record<string, any>[]} */
  const items = [];

  Object.entries(draft.currentValues._default).forEach(([key, value]) => {
    const match = key.match(new RegExp(`^${keyPath}\\.(\\d+)\\.(\\w+)$`));

    // Skip the internal properties the editor uses to track reordering
    if (match && !match[2].startsWith('__sc_')) {
      items[Number(match[1])] ??= {};
      items[Number(match[1])][match[2]] = value;
    }
  });

  return items;
};

describe('ListEditorComplex', () => {
  test('shows an expandable item per entry with the subfield editors', async () => {
    const { draft, container } = await renderEditor(authorsField, {
      'authors.0.name': 'Melvin',
      'authors.0.role': 'Editor',
      'authors.1.name': 'Elsie',
      'authors.1.role': 'Writer',
    });

    const items = container.querySelectorAll('.item');

    expect(items).toHaveLength(2);

    const name = page
      .elementLocator(/** @type {HTMLElement} */ (items[1]))
      .getByRole('group', { name: /name/ })
      .getByRole('textbox');

    await expect.element(name).toHaveValue('Elsie');
    await name.fill('Elsa');
    await expect.poll(() => draft.currentValues._default['authors.1.name']).toBe('Elsa');
  });

  test('adds an item with the default values', async () => {
    const { draft } = await renderEditor(authorsField, { 'authors.0.name': 'Melvin' });

    await page.getByRole('button', { name: /Add\W+Author/ }).click();

    await expect
      .poll(() => getStoredItems(draft, 'authors'))
      .toEqual([
        { name: 'Melvin', role: '' },
        { name: 'Anonymous', role: '' },
      ]);
  });

  test('duplicates and removes an item', async () => {
    const { draft } = await renderEditor(authorsField, {
      'authors.0.name': 'Melvin',
      'authors.0.role': 'Editor',
    });

    await page.getByRole('button', { name: 'List Item Options' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect
      .poll(() => getStoredItems(draft, 'authors'))
      .toEqual([
        { name: 'Melvin', role: 'Editor' },
        { name: 'Melvin', role: 'Editor' },
      ]);

    await page.getByRole('button', { name: 'Remove' }).nth(0).click();
    await expect
      .poll(() => getStoredItems(draft, 'authors'))
      .toEqual([{ name: 'Melvin', role: 'Editor' }]);
  });

  test('reorders an item with the keyboard', async () => {
    const { draft } = await renderEditor(authorsField, {
      'authors.0.name': 'a',
      'authors.1.name': 'b',
      'authors.2.name': 'c',
    });

    await page.getByRole('button', { name: 'Reorder Item' }).nth(0).element().focus();
    await userEvent.keyboard('{End}');

    await expect
      .poll(() => getStoredItems(draft, 'authors').map(({ name }) => name))
      .toEqual(['b', 'c', 'a']);
  });

  test('collapses the items to their summaries', async () => {
    const { draft, container } = await renderEditor(authorsField, {
      'authors.0.name': 'Melvin',
      'authors.1.name': 'Elsie',
    });

    await page.getByRole('button', { name: 'Collapse All' }).click();

    await expect.poll(() => draft.expanderStates._['authors.0']).toBe(false);
    expect(page.getByRole('textbox').elements()).toHaveLength(0);
    expect(
      [...container.querySelectorAll('.item-body .summary')].map((el) => el.textContent?.trim()),
    ).toEqual(['Melvin', 'Elsie']);

    await page.getByRole('button', { name: 'Expand All' }).click();
    await expect.poll(() => page.getByRole('textbox').elements().length).toBe(4);
  });

  test('collapses the whole list', async () => {
    const { draft, container } = await renderEditor(authorsField, { 'authors.0.name': 'Melvin' });

    await page.getByRole('button', { name: 'Collapse' }).nth(0).click();

    await expect.poll(() => draft.expanderStates._['authors#']).toBe(false);
    expect(container.querySelector('.toolbar .summary')).toHaveTextContent('1 Author');
  });

  test('offers the types to add for a list with variable types', async () => {
    const { draft } = await renderEditor(sectionsField, {});

    await page.getByRole('button', { name: /Add\W+sections/ }).click();
    await page.getByRole('menuitem', { name: 'Hero' }).click();

    await expect
      .poll(() => getStoredItems(draft, 'sections'))
      .toEqual([{ type: 'hero', heading: '' }]);
    await expect
      .element(page.getByRole('button', { name: 'Collapse' }).nth(1))
      .toHaveTextContent('expand_more Hero');
  });

  test('warns about an item of an unknown type', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await renderEditor(sectionsField, { 'sections.0.type': 'video' });

      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          'warning Warning This item can’t be displayed due to an unknown type. Check the browser console for details.',
        );
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  test('respects the disabled actions', async () => {
    await renderEditor(
      {
        ...authorsField,
        allow_add: false,
        allow_remove: false,
        allow_duplicate: false,
        allow_reorder: false,
      },
      { 'authors.0.name': 'Melvin' },
    );

    expect(page.getByRole('button', { name: /Add\W+Author/ }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Remove' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'List Item Options' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Reorder Item' }).elements()).toHaveLength(0);
  });
});

describe('ListEditorComplex (more)', () => {
  /** @type {ComplexListField} */
  const tagsField = {
    name: 'tags',
    widget: 'list',
    label: 'Tags',
    label_singular: 'Tag',
    field: { name: 'tag', widget: 'string', default: 'new' },
  };

  test('handles a list with a single subfield', async () => {
    const { draft, container } = await renderEditor(tagsField, { 'tags.0': 'a', 'tags.1': 'b' });

    // The values are stored at the item key paths
    await expect.poll(() => page.getByRole('textbox').elements().length).toBe(2);
    await page.getByRole('textbox').nth(1).fill('c');
    await expect.poll(() => draft.currentValues._default['tags.1']).toBe('c');

    await page.getByRole('button', { name: /Add\W+Tag/ }).click();
    await expect.poll(() => draft.currentValues._default['tags.2']).toBe('new');

    // Collapsing shows the values as the summaries
    await page.getByRole('button', { name: 'Collapse All' }).click();
    await expect
      .poll(() =>
        [...container.querySelectorAll('.item-body .summary')].map((el) => el.textContent?.trim()),
      )
      .toEqual(['a', 'c', 'new']);
  });

  test('removes and reorders the items of a list with a single subfield', async () => {
    const { draft } = await renderEditor(tagsField, {
      'tags.0': 'a',
      'tags.1': 'b',
      'tags.2': 'c',
    });

    await expect.poll(() => page.getByRole('textbox').elements().length).toBe(3);
    await page.getByRole('button', { name: 'Reorder Item' }).nth(2).element().focus();
    await userEvent.keyboard('{Home}');
    await expect.poll(() => draft.currentValues._default['tags.0']).toBe('c');

    await page.getByRole('button', { name: 'Remove' }).nth(0).click();
    await expect.poll(() => draft.currentValues._default['tags.2']).toBeUndefined();
    expect(draft.currentValues._default['tags.0']).toBe('a');
  });

  test('can’t add items in another locale to a single-subfield list that isn’t translated', async () => {
    const i18n = {
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      initialLocales: ['en', 'fr'],
      defaultLocale: 'en',
      structure: /** @type {const} */ ('multiple_folders'),
    };

    await renderWithDraft(ListEditorComplex, {
      draft: createMockDraft({ fields: [tagsField], i18n, values: { en: {}, fr: {} } }),
      props: {
        locale: 'fr',
        keyPath: 'tags',
        typedKeyPath: 'tags',
        fieldId: 'tags',
        fieldLabel: 'Tags',
        fieldConfig: tagsField,
      },
    });

    await expect.element(page.getByRole('button', { name: /Add\W+Tag/ })).toBeDisabled();
  });

  test('adds items to the top when configured', async () => {
    const { draft } = await renderEditor(
      { ...authorsField, add_to_top: true },
      { 'authors.0.name': 'Melvin' },
    );

    // The button is in the top toolbar only
    expect(page.getByRole('button', { name: /Add\W+Author/ }).elements()).toHaveLength(1);
    await page.getByRole('button', { name: /Add\W+Author/ }).click();
    await expect
      .poll(() => getStoredItems(draft, 'authors').map(({ name }) => name))
      .toEqual(['Anonymous', 'Melvin']);
  });

  test('stops adding items at the limit, and adds around an item', async () => {
    const { draft } = await renderEditor(
      { ...authorsField, max: 2 },
      { 'authors.0.name': 'Melvin' },
    );

    await page.getByRole('button', { name: 'List Item Options' }).click();
    await page.getByRole('menuitem', { name: 'Add Item Above' }).click();
    await expect
      .poll(() => getStoredItems(draft, 'authors').map(({ name }) => name))
      .toEqual(['Anonymous', 'Melvin']);

    // The limit is reached
    await expect.element(page.getByRole('button', { name: /Add\W+Author/ })).toBeDisabled();
    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await page.getByRole('button', { name: 'List Item Options' }).nth(0).click();
    await expect.element(page.getByRole('menuitem', { name: 'Duplicate' })).toBeDisabled();
    await expect.element(page.getByRole('menuitem', { name: 'Add Item Below' })).toBeDisabled();
  });

  test('starts minimized when configured, expanding once an item is added', async () => {
    const { draft } = await renderEditor(
      { ...authorsField, minimize_collapsed: true, collapsed: true },
      { 'authors.0.name': 'Melvin' },
    );

    await expect.poll(() => draft.expanderStates._['authors#']).toBe(false);
    await expect.poll(() => draft.expanderStates._['authors.0']).toBe(false);
    await expect
      .element(page.getByRole('button', { name: 'Expand' }).nth(0))
      .toHaveAttribute('aria-expanded', 'false');

    // The add button is available while collapsed
    await page.getByRole('button', { name: /Add\W+Author/ }).click();
    await expect.poll(() => draft.expanderStates._['authors#']).toBe(true);
  });

  test('minimizes an empty list automatically', async () => {
    const { draft } = await renderEditor({ ...authorsField, minimize_collapsed: 'auto' }, {});

    // An empty list stays open, as there is nothing to hide
    await expect.poll(() => draft.expanderStates._['authors#']).toBe(true);
    await expect.element(page.getByRole('button', { name: 'Collapse' })).toBeDisabled();
    await expect.element(page.getByText('0 Authors')).toBeInTheDocument();

    // A list with items is minimized
    const withItems = await renderEditor(
      { ...authorsField, minimize_collapsed: 'auto' },
      { 'authors.0.name': 'Melvin' },
    );

    await expect.poll(() => withItems.draft.expanderStates._['authors#']).toBe(false);
  });

  test('falls back to the field name without labels', async () => {
    await renderEditor(
      { name: 'people', widget: 'list', fields: [{ name: 'name', widget: 'string' }] },
      { 'people.0.name': 'a', 'people.1.name': 'b' },
    );

    await expect.element(page.getByText('2 people')).toBeInTheDocument();

    // A single item goes by the singular label, then the plural, then the name
    await renderEditor({ ...authorsField, label_singular: undefined }, { 'authors.0.name': 'a' });
    await expect.element(page.getByText('1 Authors')).toBeInTheDocument();
    await renderEditor(
      { ...authorsField, name: 'writers', label: undefined, label_singular: undefined },
      { 'writers.0.name': 'a' },
    );
    await expect.element(page.getByText('1 writers')).toBeInTheDocument();
  });

  test('keeps the item options without duplication', async () => {
    await renderEditor({ ...authorsField, allow_duplicate: false }, { 'authors.0.name': 'Melvin' });

    await page.getByRole('button', { name: 'List Item Options' }).click();
    await sleep(150);
    expect(page.getByRole('menuitem', { name: 'Duplicate' }).elements()).toHaveLength(0);
    await expect.element(page.getByRole('menuitem', { name: 'Add Item Above' })).toBeVisible();
  });

  test('shows shorter summaries on a small screen', async () => {
    env.isSmallScreen = true;

    try {
      const { container } = await renderEditor(authorsField, {
        'authors.0.name': 'Melvin',
        'authors.1.name': 'Elsie',
      });

      await page.getByRole('button', { name: 'Collapse All' }).click();
      await expect
        .poll(() => container.querySelector('.item-body .summary')?.textContent?.trim())
        .toBe('Melvin');
    } finally {
      env.isSmallScreen = false;
    }
  });

  test('leaves a drag started within an item to the nested list', async () => {
    const { container } = await renderEditor(authorsField, { 'authors.0.name': 'a' });

    await expect.poll(() => container.querySelectorAll('.item').length).toBe(1);

    const item = /** @type {HTMLElement} */ (container.querySelector('.item'));
    const inner = /** @type {HTMLElement} */ (item.querySelector('input'));
    const dataTransfer = new DataTransfer();

    inner.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    inner.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    expect(dataTransfer.getData('text/plain')).toBe('');
    expect(item).not.toHaveClass('dragging');
  });

  test('offers the types to add around an item, and warns about a missing type key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const { draft } = await renderEditor(
        { ...sectionsField, typeKey: 'kind' },
        { 'sections.0.kind': 'hero', 'sections.0.heading': 'Hi', 'sections.1.text': 'no kind' },
      );

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('The type key is not found'));

      await page.getByRole('button', { name: 'List Item Options' }).nth(0).click();
      await page.getByRole('menuitem', { name: 'Add Item Below' }).click();
      // The type without a label goes by its name
      await page.getByRole('menuitem', { name: 'quote' }).click();

      await expect
        .poll(() => getStoredItems(draft, 'sections').map((item) => item.kind))
        .toEqual(['hero', 'quote', undefined]);
    } finally {
      warn.mockRestore();
    }
  });

  test('shows the item type as the summary label', async () => {
    const { container } = await renderEditor(
      { ...sectionsField, types: [{ ...sectionsField.types[0], summary: '{{fields.heading}}' }] },
      { 'sections.0.type': 'hero', 'sections.0.heading': 'Welcome' },
    );

    await page.getByRole('button', { name: 'Collapse' }).nth(1).click();
    await expect
      .poll(() => container.querySelector('.item-body .summary')?.textContent?.trim())
      .toBe('Welcome');
  });

  test('reorders an item by dragging', async () => {
    const { draft, container } = await renderEditor(authorsField, {
      'authors.0.name': 'a',
      'authors.1.name': 'b',
    });

    await expect.poll(() => container.querySelectorAll('.item').length).toBe(2);

    const [first, second] = container.querySelectorAll('.item');
    const dataTransfer = new DataTransfer();

    first.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    expect(dataTransfer.getData('text/plain')).toBe('a');

    // Move the pointer over the bottom half of the second item
    const { bottom } = second.getBoundingClientRect();

    second.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientY: bottom - 1,
      }),
    );
    second.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    first.dispatchEvent(new DragEvent('dragend', { bubbles: true }));

    await expect
      .poll(() => getStoredItems(draft, 'authors').map(({ name }) => name))
      .toEqual(['b', 'a']);
  });

  test('grabs an item with the reorder control', async () => {
    const { container } = await renderEditor(authorsField, {
      'authors.0.name': 'a',
      'authors.1.name': 'b',
    });

    await expect.poll(() => container.querySelectorAll('.item').length).toBe(2);

    const handle = page.getByRole('button', { name: 'Reorder Item' }).nth(0);

    handle.element().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await expect
      .poll(() => container.querySelector('.item')?.getAttribute('draggable'))
      .toBe('true');
    handle.element().dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await expect
      .poll(() => container.querySelector('.item')?.getAttribute('draggable'))
      .toBe('false');
  });

  test('is read-only in a locale whose values follow the default locale', async () => {
    const draft = createMockDraft({
      fields: [{ ...authorsField, i18n: 'duplicate' }],
      i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        initialLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structure: /** @type {const} */ ('multiple_folders'),
      },
      values: {
        en: { 'authors.0.name': 'Melvin' },
        fr: { 'authors.0.name': 'Melvin' },
      },
    });

    await renderWithDraft(ListEditorComplex, {
      draft,
      props: {
        locale: 'fr',
        keyPath: 'authors',
        typedKeyPath: 'authors',
        fieldId: 'authors',
        fieldLabel: 'Authors',
        fieldConfig: { ...authorsField, i18n: 'duplicate' },
      },
    });

    await expect.element(page.getByRole('button', { name: /Add\W+Author/ })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'List Item Options' })).toBeDisabled();
  });

  test('writes a change to every locale for a duplicated field', async () => {
    const draft = createMockDraft({
      fields: [{ ...authorsField, i18n: 'duplicate' }],
      i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        initialLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structure: /** @type {const} */ ('multiple_folders'),
      },
      values: {
        en: { 'authors.0.name': 'Melvin' },
        fr: { 'authors.0.name': 'Melvin' },
      },
    });

    await renderWithDraft(ListEditorComplex, {
      draft,
      props: {
        locale: 'en',
        keyPath: 'authors',
        typedKeyPath: 'authors',
        fieldId: 'authors',
        fieldLabel: 'Authors',
        fieldConfig: { ...authorsField, i18n: 'duplicate' },
      },
    });

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => draft.currentValues.en['authors.0.name']).toBeUndefined();
    expect(draft.currentValues.fr['authors.0.name']).toBeUndefined();
  });

  test('does nothing once the draft is gone', async () => {
    const { entryDraft } = await renderEditor(authorsField, { 'authors.0.name': 'Melvin' });

    await expect.element(page.getByRole('button', { name: 'Remove' })).toBeInTheDocument();

    // The editor is being closed, so the items are gone
    entryDraft.current = null;

    await expect.element(page.getByText('0 Authors')).toBeInTheDocument();
    await page.getByRole('button', { name: /Add\W+Author/ }).click({ force: true });
    await page.getByRole('button', { name: 'Collapse' }).click({ force: true });
    await expect.element(page.getByText('0 Authors')).toBeInTheDocument();
  });

  test('allows adding items in another locale when a subfield is translatable', async () => {
    const i18n = {
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      initialLocales: ['en', 'fr'],
      defaultLocale: 'en',
      structure: /** @type {const} */ ('multiple_folders'),
    };

    const translatable = {
      ...sectionsField,
      types: [{ name: 'hero', fields: [{ name: 'heading', widget: 'string', i18n: true }] }],
    };

    const draft = createMockDraft({
      fields: [translatable],
      i18n,
      values: { en: {}, fr: {} },
    });

    await renderWithDraft(ListEditorComplex, {
      draft,
      props: {
        locale: 'fr',
        keyPath: 'sections',
        typedKeyPath: 'sections',
        fieldId: 'sections',
        fieldLabel: 'sections',
        fieldConfig: translatable,
      },
    });

    await expect.element(page.getByRole('button', { name: /Add\W+sections/ })).toBeEnabled();

    // But not when no subfield is
    const fixed = { ...authorsField, fields: [{ name: 'name', widget: 'string' }] };

    await renderWithDraft(ListEditorComplex, {
      draft: createMockDraft({ fields: [fixed], i18n, values: { en: {}, fr: {} } }),
      props: {
        locale: 'fr',
        keyPath: 'authors',
        typedKeyPath: 'authors',
        fieldId: 'authors',
        fieldLabel: 'Authors',
        fieldConfig: fixed,
      },
    });

    await expect.element(page.getByRole('button', { name: /Add\W+Author/ })).toBeDisabled();
  });

  /** @type {ComplexListField} */
  const galleryField = {
    name: 'gallery',
    widget: 'list',
    thumbnail: 'fields.image',
    fields: [
      { name: 'image', widget: 'image' },
      { name: 'file', widget: 'file' },
      { name: 'caption', widget: 'string' },
      { name: 'mobile', widget: 'object', fields: [{ name: 'src', widget: 'image' }] },
    ],
  };

  /** @type {ComplexListField} */
  const imagesField = {
    name: 'images',
    widget: 'list',
    thumbnail: 'image',
    field: { name: 'image', widget: 'image' },
  };

  beforeAll(async () => {
    // The thumbnail fields are looked up in the site configuration
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [galleryField, imagesField],
        },
      ],
    });
    setAssets([
      createMockAsset({
        name: 'photo.png',
        file: await createMockImageFile(),
        asset: { folder: globalAssetFolder.current },
      }),
    ]);
  });

  test('shows the thumbnails of collapsed items', async () => {
    const { draft, container } = await renderEditor(galleryField, {
      'gallery.0.image': '/static/uploads/photo.png',
      'gallery.0.caption': 'A photo',
      'gallery.1.image': '',
      'gallery.1.caption': 'No photo',
    });

    await page.getByRole('button', { name: 'Collapse All' }).click();
    await expect.poll(() => draft.expanderStates._['gallery.0']).toBe(false);
    await expect
      .poll(() => container.querySelector('.item-body .summary img')?.getAttribute('src'))
      .toMatch(/^blob:/);
    expect(container.querySelectorAll('.item-body .summary img')).toHaveLength(1);
  });

  test('shows the thumbnails of a single-subfield image list', async () => {
    const { container } = await renderEditor(imagesField, {
      'images.0': '/static/uploads/photo.png',
    });

    await page.getByRole('button', { name: 'Collapse' }).nth(1).click();
    await expect
      .poll(() => container.querySelector('.item-body .summary img')?.getAttribute('src'))
      .toMatch(/^blob:/);
  });

  test('shows the thumbnails of a File field', async () => {
    const { container } = await renderEditor(
      { ...galleryField, thumbnail: 'file' },
      { 'gallery.0.file': '/static/uploads/photo.png', 'gallery.0.caption': 'A photo' },
    );

    await page.getByRole('button', { name: 'Collapse' }).nth(1).click();
    await expect
      .poll(() => container.querySelector('.item-body .summary img')?.getAttribute('src'))
      .toMatch(/^blob:/);
  });

  test('shows the thumbnails of a nested field', async () => {
    const { container } = await renderEditor(
      { ...galleryField, thumbnail: 'mobile.src' },
      { 'gallery.0.mobile.src': '/static/uploads/photo.png', 'gallery.0.caption': 'A photo' },
    );

    await page.getByRole('button', { name: 'Collapse' }).nth(1).click();
    await expect
      .poll(() => container.querySelector('.item-body .summary img')?.getAttribute('src'))
      .toMatch(/^blob:/);
  });

  test('shows no thumbnail for a field that isn’t an image', async () => {
    const { draft, container } = await renderEditor(
      { ...galleryField, thumbnail: 'fields.caption' },
      { 'gallery.0.image': '/static/uploads/photo.png', 'gallery.0.caption': 'A photo' },
    );

    // A single item has no Collapse All button
    await page.getByRole('button', { name: 'Collapse' }).nth(1).click();
    await expect.poll(() => draft.expanderStates._['gallery.0']).toBe(false);
    // The summary defaults to the first field
    await expect.element(page.getByText('/static/uploads/photo.png')).toBeInTheDocument();
    expect(container.querySelector('.item-body .summary img')).toBeNull();
  });
});
