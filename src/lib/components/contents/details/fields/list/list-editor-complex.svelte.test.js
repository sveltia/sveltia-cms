import { createElement } from 'react';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { customFieldTypeRegistry } from '$lib/services/api/registries';
import { globalAssetFolder } from '$lib/services/assets/folders';
import { env } from '$lib/services/user/env.svelte';
import { createMockAsset, createMockImageFile, initTestConfig, setAssets } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';
import { renderFieldEditor } from '$lib/test/field.svelte';

import ListEditorComplex from './list-editor-complex.svelte';

/**
 * @import { ComplexListField } from '$lib/types/public';
 */

// The custom field type components are rendered with React and receive Immutable Maps
vi.mock('$lib/services/app/dependencies', async (importOriginal) => ({
  ...(await importOriginal()),
  loadModule: vi.fn(() => import('immutable')),
  loadChunk: vi.fn(() => import('$lib/chunks/react-dom.js')),
}));
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
 * @param {Record<string, any>} [props] Any other props, e.g. `required`.
 * @returns {Promise<{ draft: any, container: HTMLElement, entryDraft: any }>} Draft, container
 * and draft state.
 */
const renderEditor = async (fieldConfig, values, props = {}) => {
  const draft = createMockDraft({ fields: [fieldConfig], values: { _default: values } });

  const { container, entryDraft } = await renderFieldEditor(ListEditorComplex, {
    fieldConfig,
    locale: '_default',
    props,
    draft,
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
      // The existing item's unset `role` is left alone by its editor, while the new item gets the
      // subfield defaults
      .toEqual([{ name: 'Melvin' }, { name: 'Anonymous', role: '' }]);
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

  test('moves focus to the next item, or the previous one, after removing an item', async () => {
    const { draft, container } = await renderEditor(authorsField, {
      'authors.0.name': 'Melvin',
      'authors.1.name': 'Elsie',
      'authors.2.name': 'Sarah',
    });

    /**
     * Get the expander button of the item at the given position.
     * @param {number} index Item index.
     * @returns {HTMLButtonElement | null | undefined} Button.
     */
    const getExpander = (index) =>
      container.querySelectorAll('.item-wrapper')[index]?.querySelector('button');

    // Removing the middle item focuses the one that takes its place
    await page.getByRole('button', { name: 'Remove' }).nth(1).click();
    await expect
      .poll(() => getStoredItems(draft, 'authors').map(({ name }) => name))
      .toEqual(['Melvin', 'Sarah']);
    await expect.poll(() => document.activeElement).toBe(getExpander(1));

    // Removing the last item focuses the previous one
    await page.getByRole('button', { name: 'Remove' }).nth(1).click();
    await expect
      .poll(() => getStoredItems(draft, 'authors').map(({ name }) => name))
      .toEqual(['Melvin']);
    await expect.poll(() => document.activeElement).toBe(getExpander(0));
    expect(getExpander(0)).toBeInstanceOf(HTMLButtonElement);
  });

  test('doesn’t take the original position of the item it duplicates', async () => {
    const { draft } = await renderEditor(authorsField, {
      'authors.0.name': 'Melvin',
      'authors.0.role': 'Editor',
    });

    const values = draft.currentValues._default;

    // The first duplication tags the existing item with its original position
    await page.getByRole('button', { name: 'List Item Options' }).nth(0).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect.poll(() => values['authors.0.__sc_item_original_key_path']).toBe('authors.0');
    await expect.poll(() => getStoredItems(draft, 'authors')).toHaveLength(2);

    // A copy of the tagged item is new, so a revert doesn’t treat it as the original item
    await page.getByRole('button', { name: 'List Item Options' }).nth(0).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect.poll(() => getStoredItems(draft, 'authors')).toHaveLength(3);
    expect(values['authors.0.__sc_item_original_key_path']).toBe('authors.0');
    expect(values['authors.1.__sc_item_original_key_path']).toBeUndefined();
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

  test('reorders an item with the Move Up/Down buttons beside the drag handle', async () => {
    const { draft } = await renderEditor(authorsField, {
      'authors.0.name': 'a',
      'authors.1.name': 'b',
      'authors.2.name': 'c',
    });

    const first = page.getByRole('group', { name: 'Item 1 of 3' });

    // The buttons are there with a mouse, along with the handle
    await expect.element(first.getByRole('button', { name: 'Reorder Item' })).toBeVisible();
    await expect.element(first.getByRole('button', { name: 'Move Up' })).toBeDisabled();
    await first.getByRole('button', { name: 'Move Down' }).click();

    await expect
      .poll(() => getStoredItems(draft, 'authors').map(({ name }) => name))
      .toEqual(['b', 'a', 'c']);
    // The focus follows the item to its new position
    await expect
      .element(
        page.getByRole('group', { name: 'Item 2 of 3' }).getByRole('button', { name: 'Move Down' }),
      )
      .toHaveFocus();
  });

  test('hides the header end buttons until the item is hovered or has focus', async () => {
    await renderEditor(authorsField, { 'authors.0.name': 'a', 'authors.1.name': 'b' });

    // Without hover, there’s no rule hiding the buttons for the test to check
    expect(matchMedia('(hover: hover)').matches).toBe(true);

    const first = page.getByRole('group', { name: 'Item 1 of 2' });
    const names = ['Move Up', 'Move Down', 'List Item Options', 'Remove'];

    /**
     * Get the opacity of the buttons at the end of the first item’s header.
     * @returns {string[]} Opacities.
     */
    const getOpacities = () =>
      names.map(
        (name) => getComputedStyle(first.getByRole('button', { name }).first().element()).opacity,
      );

    await userEvent.unhover(first);
    await expect.poll(getOpacities).toEqual(['0', '0', '0', '0']);
    await userEvent.hover(first);
    await expect.poll(getOpacities).toEqual(['1', '1', '1', '1']);
    await userEvent.unhover(first);
    await expect.poll(getOpacities).toEqual(['0', '0', '0', '0']);
    // A keyboard user in the item can see the buttons
    first.getByRole('textbox').first().element().focus();
    await expect.poll(getOpacities).toEqual(['1', '1', '1', '1']);
    // The handle stays visible
    await expect
      .element(
        page
          .getByRole('group', { name: 'Item 2 of 2' })
          .getByRole('button', { name: 'Reorder Item' }),
      )
      .toHaveStyle({ opacity: '1' });

    // The options button stays visible while its menu is open, wherever the pointer and focus are
    const options = first.getByRole('button', { name: 'List Item Options' });

    await options.click();
    await expect.element(options).toHaveAttribute('aria-expanded', 'true');
    await userEvent.unhover(first);
    await expect.element(options).toHaveStyle({ opacity: '1' });
    await userEvent.keyboard('{Escape}');
    await expect.element(options).toHaveAttribute('aria-expanded', 'false');
  });

  test('shows the position of each item, following a move', async () => {
    const { container } = await renderEditor(authorsField, {
      'authors.0.name': 'a',
      'authors.1.name': 'b',
      'authors.2.name': 'c',
    });

    /**
     * Get the positions shown in the item headers, in the order on screen.
     * @returns {string[]} Positions.
     */
    const getPositions = () =>
      [...container.querySelectorAll('.item .position')].map((el) => el.textContent.trim());

    await expect.poll(getPositions).toEqual(['1', '2', '3']);

    const first = page.getByRole('group', { name: 'Item 1 of 3' });

    await expect.element(first.getByRole('textbox').first()).toHaveValue('a');

    await page.getByRole('button', { name: 'Reorder Item' }).nth(0).element().focus();
    await userEvent.keyboard('{End}');

    await expect.poll(getPositions).toEqual(['1', '2', '3']);
    await expect
      .element(page.getByRole('group', { name: 'Item 3 of 3' }).getByRole('textbox').first())
      .toHaveValue('a');
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
      .toHaveTextContent('expand_more 1 Hero');
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

  test('adds an item with an empty pair to a list with a single KeyValue subfield', async () => {
    /** @type {ComplexListField} */
    const pairsField = {
      name: 'pairs',
      widget: 'list',
      label: 'Pairs',
      label_singular: 'Pair',
      field: { name: 'pair', widget: 'keyvalue' },
    };

    const { draft } = await renderEditor(pairsField, { 'pairs.0.foo': 'bar' });

    await page.getByRole('button', { name: /Add\W+Pair/ }).click();

    // The empty key is kept as is, not turned into an array index
    await expect.poll(() => draft.currentValues._default['pairs.1.']).toBe('');
    expect(Object.keys(draft.currentValues._default)).not.toContain('pairs.1.0');
    expect(draft.currentValues._default['pairs.0.foo']).toBe('bar');
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

    // The limit is reached, so the add button and the item options are gone
    await expect
      .poll(() => page.getByRole('button', { name: /Add\W+Author/ }).elements())
      .toHaveLength(0);
    expect(page.getByRole('button', { name: 'List Item Options' }).elements()).toHaveLength(0);
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

  test('has nothing to expand for an item of a type without subfields', async () => {
    const { draft, container } = await renderEditor(
      { ...sectionsField, types: [{ name: 'divider', label: 'Divider' }] },
      { 'sections.0.type': 'divider' },
    );

    // Only the type is saved for such an item, so the editor has no subfields to show
    expect(container.querySelector('.item-body')).toHaveTextContent('');
    expect(draft.expanderStates._['sections.0']).toBe(true);

    await page.getByRole('button', { name: 'Collapse' }).nth(1).click();
    // The item’s state isn’t tracked, unlike the list’s own
    expect(draft.expanderStates._['sections.0']).toBe(true);

    await page.getByRole('button', { name: 'Collapse' }).nth(0).click();
    await expect.poll(() => draft.expanderStates._['sections#']).toBe(false);
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

    // The positions follow the drag preview before the item is dropped
    await expect.poll(() => first.querySelector('.position')?.textContent.trim()).toBe('2');
    expect(first).toHaveAttribute('aria-label', 'Item 2 of 2');

    second.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    first.dispatchEvent(new DragEvent('dragend', { bubbles: true }));

    await expect
      .poll(() => getStoredItems(draft, 'authors').map(({ name }) => name))
      .toEqual(['b', 'a']);
  });

  test('describes a dragged item with the summary of its type', async () => {
    const { container } = await renderEditor(
      { ...sectionsField, types: [{ ...sectionsField.types[0], summary: '{{fields.heading}}' }] },
      { 'sections.0.type': 'hero', 'sections.0.heading': 'Welcome' },
    );

    await expect.poll(() => container.querySelectorAll('.item').length).toBe(1);

    const item = /** @type {HTMLElement} */ (container.querySelector('.item'));
    const dataTransfer = new DataTransfer();

    item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    expect(dataTransfer.getData('text/plain')).toBe('Welcome');
    item.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
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
    // Removing the item would remove it from the default locale as well
    await expect.element(page.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  test('locks the items of a read-only field', async () => {
    // e.g. a List field duplicated in another locale along with its Object field
    await renderEditor(
      authorsField,
      { 'authors.0.name': 'Melvin', 'authors.1.name': 'Elsie' },
      {
        readonly: true,
      },
    );

    await expect.element(page.getByRole('button', { name: /Add\W+Author/ })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Remove' }).nth(0)).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Reorder Item' }).nth(0)).toBeDisabled();
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

  describe('a translatable list with a duplicated subfield', () => {
    // https://github.com/sveltia/sveltia-cms/issues/1065
    /** @type {ComplexListField} */
    const residencesField = {
      name: 'residences',
      widget: 'list',
      label_singular: 'Residence',
      i18n: true,
      fields: [
        { name: 'name', widget: 'string', i18n: 'duplicate' },
        { name: 'description', widget: 'text', i18n: true },
      ],
    };

    /**
     * Render the editor for the given locale of an entry with two residences in both locales.
     * @param {string} locale Locale.
     * @returns {Promise<any>} Draft.
     */
    const renderResidences = async (locale) => {
      const draft = createMockDraft({
        fields: [residencesField],
        i18n: {
          i18nEnabled: true,
          allLocales: ['fr', 'en'],
          initialLocales: ['fr', 'en'],
          defaultLocale: 'fr',
          structure: /** @type {const} */ ('single_file'),
        },
        values: {
          fr: {
            'residences.0.name': 'A',
            'residences.0.description': 'A (fr)',
            'residences.1.name': 'B',
            'residences.1.description': 'B (fr)',
          },
          en: {
            'residences.0.name': 'A',
            'residences.0.description': 'A (en)',
            'residences.1.name': 'B',
            'residences.1.description': 'B (en)',
          },
        },
      });

      await renderWithDraft(ListEditorComplex, {
        draft,
        props: {
          locale,
          keyPath: 'residences',
          typedKeyPath: 'residences',
          fieldId: 'residences',
          fieldLabel: 'Residences',
          fieldConfig: residencesField,
        },
      });

      return draft;
    };

    test('removes an item from every locale', async () => {
      const draft = await renderResidences('fr');

      await page.getByRole('button', { name: 'Remove' }).nth(0).click();
      await expect.poll(() => draft.currentValues.fr['residences.1.name']).toBeUndefined();
      expect(draft.currentValues.fr['residences.0.description']).toBe('B (fr)');
      // The translation follows its item rather than staying at its position
      expect(draft.currentValues.en['residences.0.name']).toBe('B');
      expect(draft.currentValues.en['residences.0.description']).toBe('B (en)');
      expect(draft.currentValues.en['residences.1.name']).toBeUndefined();
    });

    test('adds an item to every locale', async () => {
      const draft = await renderResidences('fr');

      await page.getByRole('button', { name: /Add\W+Residence/ }).click();
      await expect.poll(() => draft.currentValues.fr['residences.2.name']).toBe('');
      expect(draft.currentValues.en['residences.2.name']).toBe('');
      expect(draft.currentValues.en['residences.1.description']).toBe('B (en)');
    });

    test('locks the items in another locale', async () => {
      await renderResidences('en');

      await expect.element(page.getByRole('button', { name: /Add\W+Residence/ })).toBeDisabled();
      await expect.element(page.getByRole('button', { name: 'Remove' }).nth(0)).toBeDisabled();
    });
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

  test('adds items with their defaults in another locale within a rich text editor component', async () => {
    const i18n = {
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      initialLocales: ['en', 'fr'],
      defaultLocale: 'en',
      structure: /** @type {const} */ ('multiple_folders'),
    };

    const draft = createMockDraft({ fields: [], i18n, values: { en: {}, fr: {} } });

    await renderWithDraft(ListEditorComplex, {
      draft,
      props: {
        locale: 'fr',
        keyPath: 'body:c1:authors',
        typedKeyPath: 'body:c1:authors',
        fieldId: 'authors',
        fieldLabel: 'Authors',
        fieldConfig: authorsField,
      },
      context: { 'field-editor': { valueStoreKey: 'extraValues', parentComponentNames: ['yt'] } },
    });

    const addButton = page.getByRole('button', { name: /Add\W+Author/ });

    // The subfields have no `i18n` option, but the values live in the French document
    await expect.element(addButton).toBeEnabled();
    await addButton.click();

    await expect.poll(() => draft.extraValues.fr['body:c1:authors.0.name']).toBe('Anonymous');
    expect(draft.extraValues.fr['body:c1:authors.0.role']).toBe('');
    expect(draft.currentValues.fr).toEqual({});
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

describe('ListEditorComplex (single item)', () => {
  /** @type {ComplexListField} */
  const authorField = { ...authorsField, max: 1 };

  test('shows a required item without the list controls', async () => {
    const { container } = await renderEditor(authorField, { 'authors.0.name': 'Melvin' });

    await expect.element(page.getByRole('textbox').nth(0)).toHaveValue('Melvin');
    // No item count, list toggle, reorder controls or Remove button; only the item’s own toggle
    expect(page.getByText('1 Author').elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Collapse' }).elements()).toHaveLength(1);
    expect(page.getByRole('button', { name: 'Reorder Item' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Remove' }).elements()).toHaveLength(0);
    // Nor a position, which would always be 1
    expect(container.querySelector('.position')).toBeNull();
    expect(container.querySelector('.item')).not.toHaveAttribute('aria-label');
    // The list is labelled with the field name instead of the item count
    expect(container.querySelector('[hidden]')?.textContent).toBe('Author');
  });

  test('keeps the item open when the list would start minimized', async () => {
    const { container } = await renderEditor(
      { ...authorField, minimize_collapsed: true },
      { 'authors.0.name': 'Melvin' },
    );

    await expect.element(page.getByRole('textbox').nth(0)).toBeVisible();
    expect(container.querySelector('.item-list.collapsed')).toBeNull();
  });

  test('lets an optional item be removed and added again', async () => {
    const { draft } = await renderEditor(
      authorField,
      { 'authors.0.name': 'Melvin' },
      { required: false },
    );

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => getStoredItems(draft, 'authors')).toEqual([]);
    // The empty list shows the Add button alone, still without an item count
    expect(page.getByText('0 Authors').elements()).toHaveLength(0);

    await page.getByRole('button', { name: /Add\W+Author/ }).click();
    await expect
      .poll(() => getStoredItems(draft, 'authors').map(({ name }) => name))
      .toEqual(['Anonymous']);
    await expect
      .poll(() => page.getByRole('button', { name: /Add\W+Author/ }).elements())
      .toHaveLength(0);
  });

  test('lets the item of a list with variable types be removed to choose another type', async () => {
    await renderEditor({ ...sectionsField, max: 1 }, { 'sections.0.type': 'hero' });

    await expect.element(page.getByRole('button', { name: 'Remove' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Reorder Item' }).elements()).toHaveLength(0);
  });

  test('locks the item in a locale whose values follow the default locale', async () => {
    // The field editor makes a field duplicated from the default locale read-only there
    await renderEditor(
      authorField,
      { 'authors.0.name': 'Melvin' },
      { required: false, readonly: true },
    );

    // The optional item can’t be removed there, which would remove it from the default locale
    await expect.element(page.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  test('can’t add the item in a locale whose values follow the default locale', async () => {
    await renderEditor(authorField, {}, { required: false, readonly: true });

    await expect.element(page.getByRole('button', { name: /Add\W+Author/ })).toBeDisabled();
  });

  test('shows the list controls for more items than the limit', async () => {
    await renderEditor(authorField, { 'authors.0.name': 'Melvin', 'authors.1.name': 'Elsie' });

    // The extra item has to be removable
    await expect.element(page.getByText('2 Authors')).toBeVisible();
    expect(page.getByRole('button', { name: 'Remove' }).elements()).toHaveLength(2);
    expect(page.getByRole('button', { name: 'Reorder Item' }).elements()).toHaveLength(2);
  });
});

describe('ListEditorComplex with a custom field type', () => {
  /** @type {ComplexListField} */
  const photosField = {
    name: 'photos',
    widget: 'list',
    label: 'Photos',
    label_singular: 'Photo',
    collapsed: true,
    field: { name: 'photo', widget: 'photo-picker', default: 'c/3.jpg' },
  };

  /**
   * Get the text of the collapsed items’ summaries.
   * @param {HTMLElement} container Container.
   * @returns {(string | undefined)[]} Summaries.
   */
  const getSummaries = (container) =>
    [...container.querySelectorAll('.item-body .summary')].map((el) => el.textContent?.trim());

  /**
   * A custom field control.
   * @returns {any} React element.
   */
  const PickerControl = () => createElement('span', null, 'Picker');

  /**
   * A custom field summary.
   * @param {any} props Props.
   * @returns {any} React element.
   */
  const PhotoSummary = ({ value, field }) =>
    createElement('strong', { className: 'photo-summary' }, `${field.get('name')}: ${value}`);

  beforeAll(() => {
    customFieldTypeRegistry.set('photo-picker', { control: PickerControl, summary: PhotoSummary });
    customFieldTypeRegistry.set('plain-picker', { control: PickerControl });
  });

  afterAll(() => {
    customFieldTypeRegistry.delete('photo-picker');
    customFieldTypeRegistry.delete('plain-picker');
  });

  test('draws collapsed items with the summary component of the type', async () => {
    const { draft, container } = await renderEditor(photosField, {
      'photos.0': 'a/1.jpg',
      'photos.1': 'b/2.jpg',
    });

    await expect.poll(() => getSummaries(container)).toEqual(['photo: a/1.jpg', 'photo: b/2.jpg']);
    expect(container.querySelectorAll('.item-body .summary .photo-summary')).toHaveLength(2);

    // After a reorder
    await page.getByRole('button', { name: 'Reorder Item' }).nth(0).element().focus();
    await userEvent.keyboard('{End}');
    await expect.poll(() => getSummaries(container)).toEqual(['photo: b/2.jpg', 'photo: a/1.jpg']);

    // After an item is added and everything collapsed again
    await page.getByRole('button', { name: /Add\W+Photo/ }).click();
    await expect.poll(() => draft.currentValues._default['photos.2']).toBe('c/3.jpg');
    await page.getByRole('button', { name: 'Collapse All' }).click();
    await expect
      .poll(() => getSummaries(container))
      .toEqual(['photo: b/2.jpg', 'photo: a/1.jpg', 'photo: c/3.jpg']);
  });

  test('draws the summary text for a type without a summary component', async () => {
    const { container } = await renderEditor(
      { ...photosField, field: { name: 'photo', widget: 'plain-picker' } },
      { 'photos.0': 'a/1.jpg' },
    );

    await expect.poll(() => getSummaries(container)).toEqual(['a/1.jpg']);
  });
});
