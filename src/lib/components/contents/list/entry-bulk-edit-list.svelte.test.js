import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { validateBulkEdits } from '$lib/services/contents/collection/entries/bulk-edit';
import {
  bulkEditedEntries,
  bulkEditErrors,
  bulkEdits,
  bulkEditSaving,
  setBulkEditMode,
} from '$lib/services/contents/collection/view';
import { entryListSettings } from '$lib/services/contents/collection/view/settings';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import EntryBulkEditList from './entry-bulk-edit-list.svelte';

describe('EntryBulkEditList', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          bulk_edit: true,
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            // Without a label, the column is named after the field
            { name: 'draft', widget: 'boolean', required: false },
            { name: 'category', label: 'Category', widget: 'string', required: false },
            // Not a field that can be edited in bulk
            { name: 'body', label: 'Body', widget: 'markdown' },
          ],
          view_groups: [{ label: 'Category', field: 'category' }],
        },
      ],
    });
  });

  /**
   * Select the collection with the given saved view, then enter the bulk edit mode.
   * @param {any} [view] View settings.
   */
  const enterBulkEditMode = (view = { type: 'list' }) => {
    entryListSettings.current = { posts: view };
    selectedCollection.current = getCollection('posts');
    // Let the view be restored for the collection before the mode is entered
    flushSync();
    setBulkEditMode(true);
  };

  /**
   * Render the bulk editor for the collection.
   * @returns {ReturnType<typeof render>} Result.
   */
  const renderList = () =>
    render(EntryBulkEditList, { collection: /** @type {any} */ (getCollection('posts')) });

  /**
   * Get the text of the row headers, which are the entry titles.
   * @returns {string[]} Texts.
   */
  const getRowHeaders = () =>
    page
      .getByRole('rowheader')
      .elements()
      .map((el) => el.textContent?.trim() ?? '');

  beforeEach(() => {
    setEntries([
      createMockEntry({
        slug: 'a',
        content: { _default: { title: 'A', draft: true, category: 'news', body: 'Hi' } },
      }),
      createMockEntry({ slug: 'b', content: { _default: { title: 'B', category: 'blog' } } }),
      // An entry without content in the default locale can’t be edited
      createMockEntry({ slug: 'c', content: { fr: { title: 'C' } } }),
    ]);
  });

  test('lists the editable entries with a column for each editable field', async () => {
    enterBulkEditMode();

    await renderList();

    const table = page.getByRole('table', { name: 'Bulk Editor' });

    await expect.element(table).toHaveAttribute('aria-rowcount', '3');
    expect(
      table
        .getByRole('columnheader')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Entry', 'Title', 'draft', 'Category']);
    await expect.poll(getRowHeaders).toEqual(['A', 'B']);
    expect(bulkEditedEntries.current.map(({ slug }) => slug)).toEqual(['a', 'b']);

    const rows = table.getByRole('row');

    await expect.element(rows.nth(0)).toHaveAttribute('aria-rowindex', '1');
    await expect.element(rows.nth(1)).toHaveAttribute('aria-rowindex', '2');
    await expect.element(rows.nth(2)).toHaveAttribute('aria-rowindex', '3');

    // Each control is named after the field and the entry
    await expect
      .element(page.getByRole('textbox', { name: '\u2068Title\u2069 of \u2068A\u2069' }))
      .toHaveValue('A');
    await expect
      .element(page.getByRole('textbox', { name: '\u2068Category\u2069 of \u2068B\u2069' }))
      .toHaveValue('blog');
    await expect
      .element(page.getByRole('switch', { name: '\u2068draft\u2069 of \u2068A\u2069' }))
      .toBeChecked();
    await expect
      .element(page.getByRole('switch', { name: '\u2068draft\u2069 of \u2068B\u2069' }))
      .not.toBeChecked();
  });

  test('keeps the rows as they were when the mode was entered', async () => {
    enterBulkEditMode();

    await renderList();
    await expect.poll(getRowHeaders).toEqual(['A', 'B']);

    // A background refresh doesn’t change the rows
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A' } } }),
      createMockEntry({ slug: 'd', content: { _default: { title: 'D' } } }),
    ]);
    flushSync();
    expect(getRowHeaders()).toEqual(['A', 'B']);
    expect(bulkEditedEntries.current.map(({ slug }) => slug)).toEqual(['a', 'b']);
  });

  test('lists the entries group by group, leaving out a group with nothing to edit', async () => {
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A', category: 'news' } } }),
      createMockEntry({ slug: 'b', content: { _default: { title: 'B', category: 'blog' } } }),
      createMockEntry({ slug: 'e', content: { _default: { title: 'E', category: 'news' } } }),
      // The only entry of the Other group can’t be edited
      createMockEntry({ slug: 'c', content: { fr: { title: 'C' } } }),
    ]);
    enterBulkEditMode({ type: 'list', group: { field: 'category' } });

    await renderList();

    await expect.poll(getRowHeaders).toEqual(['B', 'A', 'E']);
    expect(bulkEditedEntries.current.map(({ slug }) => slug)).toEqual(['b', 'a', 'e']);
    await expect.element(page.getByRole('table')).toHaveAttribute('aria-rowcount', '4');

    // Each group is a row group named after it, and its header isn’t a row
    const rowGroups = page.getByRole('rowgroup').elements();

    expect(rowGroups.map((group) => group.getAttribute('aria-label'))).toEqual(['blog', 'news']);
    expect(rowGroups.map((group) => group.textContent?.trim().split(/\s+/)[0])).toEqual([
      'blog',
      'news',
    ]);

    const indexes = page
      .getByRole('row')
      .elements()
      .map((row) => row.getAttribute('aria-rowindex'));

    expect(indexes).toEqual(['1', '2', '3', '4']);
  });

  test('records an edit, and marks the edited cell', async () => {
    enterBulkEditMode();

    await renderList();

    const textbox = page.getByRole('textbox', { name: '\u2068Title\u2069 of \u2068A\u2069' });

    await textbox.fill('Alpha');
    await expect.poll(() => bulkEdits.current).toEqual({ 'content/posts/a': { title: 'Alpha' } });
    await expect
      .poll(() => textbox.element().closest('.cell[data-field-type]')?.classList.contains('edited'))
      .toBe(true);
    expect(bulkEditErrors.current).toEqual({});

    // Bringing the value back drops the edit
    await textbox.fill('A');
    await expect.poll(() => bulkEdits.current).toEqual({});

    await page.getByRole('switch', { name: '\u2068draft\u2069 of \u2068B\u2069' }).click();
    await expect.poll(() => bulkEdits.current).toEqual({ 'content/posts/b': { draft: true } });
  });

  test('makes the cells read-only while the edits are being saved', async () => {
    enterBulkEditMode();

    await renderList();

    const textbox = page.getByRole('textbox', { name: '\u2068Title\u2069 of \u2068A\u2069' });

    await expect.element(textbox).not.toHaveAttribute('readonly');

    try {
      bulkEditSaving.current = true;
      await expect.element(textbox).toHaveAttribute('readonly');
    } finally {
      bulkEditSaving.current = false;
    }

    await expect.element(textbox).not.toHaveAttribute('readonly');
  });

  test('validates the edits again once the invalid ones have been reported', async () => {
    enterBulkEditMode();

    await renderList();

    const textbox = page.getByRole('textbox', { name: '\u2068Title\u2069 of \u2068A\u2069' });

    await textbox.fill('');
    await expect.poll(() => bulkEdits.current).toEqual({ 'content/posts/a': { title: '' } });
    // Nothing is reported until the user tries to save
    expect(page.getByRole('alert').elements()).toHaveLength(0);

    // What the Save button does
    bulkEditErrors.current = validateBulkEdits({
      collection: /** @type {any} */ (getCollection('posts')),
      entries: bulkEditedEntries.current,
      edits: bulkEdits.current,
    });
    await expect.element(page.getByRole('alert')).toBeVisible();
    await expect.element(textbox).toHaveAttribute('aria-invalid', 'true');

    // Fixing the value clears the error
    await textbox.fill('Alpha');
    await vi.waitFor(() => expect(bulkEditErrors.current).toEqual({}));
    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });
});
