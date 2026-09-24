import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { getCollection } from '$lib/services/contents/collection';
import { createPendingEntry } from '$lib/services/contents/fields/relation/quick-add';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';
import { waitForToastsToHide } from '$lib/test/toast';

import QuickAddDialog from './quick-add-dialog.svelte';

/**
 * @import { InternalEntryCollection, PendingEntry } from '$lib/types/private';
 * @import { RelationField } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/fields/relation/quick-add', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  createPendingEntry: vi.fn(),
}));

/** @type {RelationField} */
const fieldConfig = { name: 'tags', widget: 'relation', collection: 'tags', multiple: true };

/**
 * Build a pending entry.
 * @param {string} collectionName Collection name.
 * @param {string} slug Slug.
 * @returns {PendingEntry} Pending entry.
 */
const createPending = (collectionName, slug) => ({
  collectionName,
  entry: /** @type {any} */ ({ id: `id-${slug}`, slug, subPath: slug, locales: {} }),
  changes: [],
  savingAssets: [],
  values: [slug],
});

/**
 * Render the dialog.
 * @param {object} [options] Options.
 * @param {string} [options.collectionName] Name of the collection to create an entry in.
 * @param {PendingEntry[]} [options.pendingEntries] Entries pending on the parent draft.
 * @returns {Promise<{ draft: any, props: any, onAdd: any }>} Parent draft, props and the `onAdd`
 * callback.
 */
const renderDialog = async ({ collectionName = 'tags', pendingEntries = [] } = {}) => {
  const draft = createMockDraft({ fields: [fieldConfig], draft: { pendingEntries } });
  const onAdd = vi.fn();

  const props = $state({
    open: true,
    collection: /** @type {InternalEntryCollection} */ (getCollection(collectionName)),
    fieldConfig: { ...fieldConfig, collection: collectionName },
    onAdd,
  });

  // Wait for the dialog of the previous test to be gone, so the locators don’t pick it up
  await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
  await renderWithDraft(QuickAddDialog, { draft, props });
  // The dialog moves the focus to its first input shortly after opening
  await expect.element(page.getByRole('dialog').getByRole('textbox').first()).toHaveFocus();

  return { draft, props, onAdd };
};

describe('QuickAddDialog', () => {
  beforeAll(async () => {
    await initTestConfig({
      i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
      collections: [
        {
          name: 'tags',
          label: 'Tags',
          label_singular: 'Tag',
          folder: 'content/tags',
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            { name: 'description', label: 'Description', widget: 'text', required: false },
          ],
        },
        {
          name: 'languages',
          label: 'Languages',
          label_singular: 'Language',
          folder: 'content/languages',
          // The slug is only given with the slug editor
          slug: { editable: true },
          fields: [{ name: 'title', label: 'Title', widget: 'string' }],
        },
        {
          name: 'categories',
          label: 'Categories',
          label_singular: 'Category',
          folder: 'content/categories',
          i18n: true,
          fields: [{ name: 'title', label: 'Title', widget: 'string', i18n: true }],
        },
      ],
    });
  });

  beforeEach(() => {
    vi.mocked(createPendingEntry).mockReset();
  });

  test('edits a new entry of the collection and adds it to the parent draft', async () => {
    const { draft, props, onAdd } = await renderDialog();
    const dialog = page.getByRole('dialog', { name: /Creating.*Tag/ });

    await expect
      .element(
        dialog.getByText(/The new .*Tag.* will be saved along with the entry you’re editing\./),
      )
      .toBeInTheDocument();
    // Single locale, so there’s no locale switcher
    expect(dialog.getByRole('radio').elements()).toHaveLength(0);

    const pendingEntry = createPending('tags', 'svelte');

    vi.mocked(createPendingEntry).mockResolvedValue(pendingEntry);

    await dialog.getByRole('textbox', { name: 'Title' }).fill('Svelte');
    await dialog.getByRole('textbox', { name: 'Description' }).fill('All about Svelte');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect.poll(() => props.open).toBe(false);
    expect(createPendingEntry).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        collectionName: 'tags',
        isNew: true,
        currentValues: { _default: { title: 'Svelte', description: 'All about Svelte' } },
      }),
      parentDraft: draft,
      fieldConfig: props.fieldConfig,
    });
    expect(draft.pendingEntries).toEqual([pendingEntry]);
    expect(onAdd).toHaveBeenCalledWith(pendingEntry);
  });

  test('lets the slug be given, as there’s no Slug panel in the dialog', async () => {
    const { props } = await renderDialog({ collectionName: 'languages' });
    const dialog = page.getByRole('dialog', { name: /Creating.*Language/ });
    const slugInput = dialog.getByRole('textbox', { name: 'Slug' });

    vi.mocked(createPendingEntry).mockResolvedValue(createPending('languages', 'de'));

    await expect.element(slugInput).toBeRequired();
    await dialog.getByRole('textbox', { name: 'Title' }).fill('German');
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect.element(slugInput).toHaveAttribute('aria-invalid', 'true');
    expect(createPendingEntry).not.toHaveBeenCalled();

    await slugInput.fill('de');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect.poll(() => props.open).toBe(false);
    expect(createPendingEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ currentSlugs: { _default: 'de' } }),
      }),
    );
    await waitForToastsToHide();
  });

  test('carries the entries pending on the parent over to the new entry and back', async () => {
    const inherited = createPending('tags', 'react');
    const { draft, props } = await renderDialog({ pendingEntries: [inherited] });
    const dialog = page.getByRole('dialog', { name: /Creating.*Tag/ });
    // An entry created from a Relation field of the new entry with a nested dialog, which the
    // new entry refers to
    const nested = createPending('authors', 'jane');
    const pendingEntry = createPending('tags', 'svelte');

    vi.mocked(createPendingEntry).mockImplementation(async ({ draft: subDraft }) => {
      // The new entry’s draft starts with the parent’s pending entries, so its own Relation
      // fields can offer them, and a nested dialog can count them
      expect(subDraft.pendingEntries).toEqual([inherited]);
      subDraft.pendingEntries.push(nested);
      subDraft.currentValues._default.author = 'jane';

      return pendingEntry;
    });

    await dialog.getByRole('textbox', { name: 'Title' }).fill('Svelte');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect.poll(() => props.open).toBe(false);
    // The inherited entry isn’t added again, the nested one comes along
    expect(draft.pendingEntries).toEqual([inherited, nested, pendingEntry]);
  });

  test('reports the invalid fields instead of adding the entry', async () => {
    const { draft, props, onAdd } = await renderDialog();
    const dialog = page.getByRole('dialog', { name: /Creating.*Tag/ });

    // The title is required
    await dialog.getByRole('button', { name: 'Add' }).click();

    // The field’s own error is an alert as well
    await expect
      .element(page.getByRole('alert').filter({ hasText: /has an error/ }))
      .toHaveTextContent(
        'error Error One field has an error. Please correct it to save the entry.',
      );
    await expect
      .element(dialog.getByRole('textbox', { name: 'Title' }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(props.open).toBe(true);
    expect(createPendingEntry).not.toHaveBeenCalled();
    expect(draft.pendingEntries).toEqual([]);
    expect(onAdd).not.toHaveBeenCalled();

    await waitForToastsToHide();
  });

  test('reports a failure to prepare the entry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createPendingEntry).mockRejectedValue(new Error('Oops'));

    const { draft, props, onAdd } = await renderDialog();
    const dialog = page.getByRole('dialog', { name: /Creating.*Tag/ });

    await dialog.getByRole('textbox', { name: 'Title' }).fill('Svelte');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect
      .element(page.getByRole('alert').filter({ hasText: /be added/ }))
      .toMatchTextContent(
        /The .*Tag.* couldn’t be added\. Check the browser console for details\./,
      );
    expect(props.open).toBe(true);
    expect(draft.pendingEntries).toEqual([]);
    expect(onAdd).not.toHaveBeenCalled();

    await waitForToastsToHide();
  });

  test('throws the draft away when cancelled', async () => {
    const { draft, props, onAdd } = await renderDialog();
    const dialog = page.getByRole('dialog', { name: /Creating.*Tag/ });

    await dialog.getByRole('textbox', { name: 'Title' }).fill('Svelte');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect.poll(() => props.open).toBe(false);
    expect(createPendingEntry).not.toHaveBeenCalled();
    expect(draft.pendingEntries).toEqual([]);
    expect(onAdd).not.toHaveBeenCalled();

    // Opening it again starts from scratch
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    props.open = true;
    await expect.element(dialog.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  });

  test('switches between the locales of a localized collection', async () => {
    await renderDialog({ collectionName: 'categories' });

    const dialog = page.getByRole('dialog', { name: /Creating.*Category/ });
    const title = dialog.getByRole('textbox', { name: 'Title' });

    await title.fill('Travel');
    // A Sveltia UI group starts handling clicks 100 ms after it’s mounted
    await sleep(150);
    await dialog.getByRole('radio', { name: 'French' }).click();
    await expect.element(title).toHaveValue('');
    await title.fill('Voyage');

    vi.mocked(createPendingEntry).mockResolvedValue(createPending('categories', 'travel'));

    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect.poll(() => vi.mocked(createPendingEntry).mock.calls.length).toBe(1);
    expect(createPendingEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          currentValues: { en: { title: 'Travel' }, fr: { title: 'Voyage' } },
        }),
      }),
    );
  });
});
