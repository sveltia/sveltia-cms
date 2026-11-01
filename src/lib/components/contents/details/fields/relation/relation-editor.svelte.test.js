import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { getCollection } from '$lib/services/contents/collection';
import {
  getEntryOptions,
  getOptions,
  getRefEntries,
} from '$lib/services/contents/fields/relation/helpers';
import {
  createPendingEntry,
  getCreatableCollection,
  getEditableEntries,
  hasCreationRoom,
} from '$lib/services/contents/fields/relation/quick-add';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import RelationEditor from './relation-editor.svelte';

/**
 * @import { Entry, PendingEntry } from '$lib/types/private';
 * @import { RelationField } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/fields/relation/helpers', () => ({
  getEntryOptions: vi.fn(),
  getOptions: vi.fn(),
  getReferencedOptionLabel: vi.fn(),
  getRefEntries: vi.fn(),
  optionCacheMap: new Map(),
}));

vi.mock('$lib/services/contents/fields/relation/quick-add', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  createPendingEntry: vi.fn(),
  getCreatableCollection: vi.fn(),
  getEditableEntries: vi.fn(() => []),
  hasCreationRoom: vi.fn(() => true),
}));

/** @type {RelationField} */
const fieldConfig = { name: 'author', widget: 'relation', collection: 'members' };
const refEntries = /** @type {Entry[]} */ ([{ id: 'melvin-lucas' }, { id: 'elsie-dean' }]);
/**
 * Get the members collection, which entries can be created in.
 * @returns {any} Collection.
 */
const getMemberCollection = () => getCollection('members');

describe('RelationEditor', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }, fieldConfig],
        },
        {
          name: 'members',
          label: 'Members',
          label_singular: 'Member',
          folder: 'content/members',
          fields: [{ name: 'name', label: 'Name', widget: 'string' }],
        },
      ],
    });
  });

  beforeEach(() => {
    vi.mocked(getRefEntries).mockReturnValue(refEntries);
    vi.mocked(getOptions).mockReturnValue([
      { label: 'Melvin Lucas', value: 'melvin-lucas', searchValue: 'Melvin Lucas' },
      { label: 'Elsie Dean', value: 'elsie-dean', searchValue: 'Elsie Dean' },
    ]);
    vi.mocked(getCreatableCollection).mockReturnValue(undefined);
    vi.mocked(getEditableEntries).mockReturnValue([]);
    vi.mocked(hasCreationRoom).mockReturnValue(true);
  });

  test('offers the referenced entries in the order of the options', async () => {
    const props = $state({
      locale: '_default',
      keyPath: 'author',
      typedKeyPath: 'author',
      fieldId: 'author',
      fieldLabel: 'Author',
      fieldConfig,
      currentValue: 'melvin-lucas',
    });

    await renderWithDraft(RelationEditor, {
      draft: createMockDraft({
        fields: [fieldConfig],
        values: { _default: { author: 'melvin-lucas', title: 'Hello' } },
        draft: { currentSlugs: { _default: 'hello' } },
      }),
      props,
    });

    expect(getRefEntries).toHaveBeenCalledWith(fieldConfig);
    expect(getOptions).toHaveBeenCalledWith({
      locale: '_default',
      fieldConfig,
      refEntries,
      currentLocaleValues: { author: 'melvin-lucas', title: 'Hello' },
      currentSlug: 'hello',
      pendingEntries: [],
    });

    const radios = page.getByRole('radio');

    // The options are already sorted, or not, by `getOptions`, so the editor keeps their order
    await expect.element(radios.nth(0)).toHaveAccessibleName('Melvin Lucas');
    await expect.element(radios.nth(1)).toHaveAccessibleName('Elsie Dean');
    await expect.element(radios.nth(0)).toBeChecked();

    await radios.nth(1).click();
    expect(props.currentValue).toBe('elsie-dean');

    // No entry can be created in the collection, so there’s no button for it
    expect(page.getByRole('button').elements()).toHaveLength(0);

    // The slug is shared by the locales unless localized
    await renderWithDraft(RelationEditor, {
      draft: createMockDraft({
        fields: [fieldConfig],
        values: { _default: { author: 'melvin-lucas', title: 'Hello' } },
        draft: { currentSlugs: { _: 'shared' } },
      }),
      props: { ...props },
    });
    expect(getOptions).toHaveBeenLastCalledWith(expect.objectContaining({ currentSlug: 'shared' }));
  });

  test('passes the values of the fields that aren’t localized in another locale', async () => {
    const props = {
      locale: 'ja',
      keyPath: 'author',
      typedKeyPath: 'author',
      fieldId: 'author',
      fieldLabel: 'Author',
      fieldConfig,
      currentValue: '',
    };

    const draftArgs = {
      fields: [fieldConfig],
      i18n: { i18nEnabled: true, defaultLocale: 'en', allLocales: ['en', 'ja'] },
      values: { en: { title: 'Hello', team: 'red' }, ja: { title: 'こんにちは' } },
    };

    await renderWithDraft(RelationEditor, { draft: createMockDraft(draftArgs), props });

    // The field isn’t found in the test config, so it’s taken as one that isn’t localized
    expect(getOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sharedValues: expect.objectContaining({ values: { title: 'Hello', team: 'red' } }),
      }),
    );

    // The values of a rich text editor component are localized along with the document
    await renderWithDraft(RelationEditor, {
      draft: createMockDraft(draftArgs),
      props,
      context: { 'field-editor': { valueStoreKey: 'extraValues' } },
    });

    expect(getOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ sharedValues: undefined }),
    );
  });

  test('offers the pending entries of the draft along with the saved ones', async () => {
    const pendingEntry = /** @type {Entry} */ ({ id: 'new-member', slug: 'new-member' });

    await renderWithDraft(RelationEditor, {
      draft: createMockDraft({
        fields: [fieldConfig],
        values: { _default: { author: '' } },
        draft: {
          pendingEntries: [
            {
              collectionName: 'members',
              entry: pendingEntry,
              changes: [],
              savingAssets: [],
              values: ['new-member'],
            },
          ],
        },
      }),
      props: {
        locale: '_default',
        keyPath: 'author',
        typedKeyPath: 'author',
        fieldId: 'author',
        fieldLabel: 'Author',
        fieldConfig,
        currentValue: '',
      },
    });

    expect(getOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        refEntries: [...refEntries, pendingEntry],
        // Also passed on their own, so a label referring to another pending entry resolves
        pendingEntries: [expect.objectContaining({ entry: pendingEntry })],
      }),
    );
  });

  test('creates a new entry in the referenced collection and selects it', async () => {
    vi.mocked(getCreatableCollection).mockReturnValue(getMemberCollection());

    /** @type {PendingEntry} */
    const pendingEntry = {
      collectionName: 'members',
      entry: /** @type {any} */ ({ id: 'new', slug: 'jane-doe', subPath: 'jane-doe', locales: {} }),
      changes: [],
      savingAssets: [],
      values: ['jane-doe'],
    };

    vi.mocked(createPendingEntry).mockResolvedValue(pendingEntry);

    vi.mocked(getEntryOptions).mockReturnValue([
      { label: 'Jane Doe', value: 'jane-doe', searchValue: 'Jane Doe' },
    ]);

    const draft = createMockDraft({
      fields: [fieldConfig],
      values: { _default: { author: 'melvin-lucas' } },
    });

    const props = $state({
      locale: '_default',
      keyPath: 'author',
      typedKeyPath: 'author',
      fieldId: 'author',
      fieldLabel: 'Author',
      fieldConfig,
      currentValue: 'melvin-lucas',
    });

    await renderWithDraft(RelationEditor, { draft, props });

    const button = page.getByRole('button', { name: /Add.*Member/ });

    await expect.element(button).toBeEnabled();
    await expect.element(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(getCreatableCollection).toHaveBeenCalledWith({ fieldConfig, draft });

    await button.click();

    const dialog = page.getByRole('dialog', { name: /Creating.*Member/ });

    await expect.element(dialog.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Jane Doe');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect.poll(() => draft.pendingEntries.length).toBe(1);
    expect(draft.currentValues._default.author).toBe('jane-doe');
  });

  test('disables the button when the collection is full', async () => {
    vi.mocked(getCreatableCollection).mockReturnValue(getMemberCollection());
    vi.mocked(hasCreationRoom).mockReturnValue(false);

    await renderWithDraft(RelationEditor, {
      draft: createMockDraft({ fields: [fieldConfig], values: { _default: { author: '' } } }),
      props: {
        locale: '_default',
        keyPath: 'author',
        typedKeyPath: 'author',
        fieldId: 'author',
        fieldLabel: 'Author',
        fieldConfig,
        currentValue: '',
      },
    });

    await expect.element(page.getByRole('button', { name: /Add.*Member/ })).toBeDisabled();
  });

  test('offers no button for a read-only field', async () => {
    vi.mocked(getCreatableCollection).mockReturnValue(getMemberCollection());

    await renderWithDraft(RelationEditor, {
      draft: createMockDraft({ fields: [fieldConfig], values: { _default: { author: '' } } }),
      props: {
        locale: '_default',
        keyPath: 'author',
        typedKeyPath: 'author',
        fieldId: 'author',
        fieldLabel: 'Author',
        fieldConfig,
        currentValue: '',
        readonly: true,
      },
    });

    expect(page.getByRole('button').elements()).toHaveLength(0);
    expect(getCreatableCollection).not.toHaveBeenCalled();
    expect(getEditableEntries).not.toHaveBeenCalled();
  });

  describe('editing a selected entry', () => {
    /**
     * Build a saved member.
     * @param {string} slug Slug.
     * @param {string} name Name.
     * @returns {Entry} Entry.
     */
    const createMember = (slug, name) =>
      /** @type {any} */ ({
        id: `id-${slug}`,
        slug,
        subPath: slug,
        locales: { _default: { slug, path: `content/members/${slug}.md`, content: { name } } },
      });

    const melvin = createMember('melvin-lucas', 'Melvin Lucas');
    const elsie = createMember('elsie-dean', 'Elsie Dean');

    beforeEach(() => {
      // The value an entry goes by is its slug
      vi.mocked(getEntryOptions).mockImplementation(({ refEntry }) => [
        { label: refEntry.slug, value: refEntry.slug, searchValue: refEntry.slug },
      ]);
    });

    test('edits the selected entry and follows a change of its value', async () => {
      vi.mocked(getEditableEntries).mockReturnValue([
        { value: 'melvin-lucas', label: 'Melvin Lucas', entry: melvin },
      ]);

      const updated = createMember('melvin-lucas-jr', 'Melvin Lucas Jr.');

      vi.mocked(createPendingEntry).mockResolvedValue({
        collectionName: 'members',
        entry: updated,
        changes: [],
        savingAssets: [],
        values: ['melvin-lucas-jr'],
        baseEntry: melvin,
      });

      const draft = createMockDraft({
        fields: [fieldConfig],
        values: { _default: { author: 'melvin-lucas' } },
      });

      const props = $state({
        locale: '_default',
        keyPath: 'author',
        typedKeyPath: 'author',
        fieldId: 'author',
        fieldLabel: 'Author',
        fieldConfig,
        currentValue: 'melvin-lucas',
      });

      await renderWithDraft(RelationEditor, { draft, props });

      expect(getEditableEntries).toHaveBeenCalledWith({
        draft,
        locale: '_default',
        fieldConfig,
        refEntries,
        currentValue: 'melvin-lucas',
      });
      // No entry can be created in the collection, but the selected one can be edited
      expect(page.getByRole('button', { name: /Add/ }).elements()).toHaveLength(0);

      const button = page.getByRole('button', { name: /Edit.*Melvin Lucas/ });

      await expect.element(button).toHaveAttribute('aria-haspopup', 'dialog');
      await button.click();

      const dialog = page.getByRole('dialog', { name: /Editing.*Member/ });

      await expect
        .element(dialog.getByRole('textbox', { name: 'Name' }))
        .toHaveValue('Melvin Lucas');
      await dialog.getByRole('textbox', { name: 'Name' }).fill('Melvin Lucas Jr.');
      await dialog.getByRole('button', { name: 'Update' }).click();

      await expect.poll(() => draft.pendingEntries.length).toBe(1);
      expect(draft.currentValues._default.author).toBe('melvin-lucas-jr');
    });

    test('lists the selected entries of a multiple-value field in a menu', async () => {
      const multipleField = { ...fieldConfig, multiple: true };

      vi.mocked(getCreatableCollection).mockReturnValue(getMemberCollection());
      vi.mocked(getEditableEntries).mockReturnValue([
        { value: 'melvin-lucas', label: 'Melvin Lucas', entry: melvin },
        { value: 'elsie-dean', label: 'Elsie Dean', entry: elsie },
      ]);

      await renderWithDraft(RelationEditor, {
        draft: createMockDraft({
          fields: [multipleField],
          values: { _default: { 'author.0': 'melvin-lucas', 'author.1': 'elsie-dean' } },
        }),
        props: {
          locale: '_default',
          keyPath: 'author',
          typedKeyPath: 'author',
          fieldId: 'author',
          fieldLabel: 'Author',
          fieldConfig: multipleField,
          currentValue: ['melvin-lucas', 'elsie-dean'],
        },
      });

      await expect.element(page.getByRole('button', { name: /Add.*Member/ })).toBeEnabled();
      await page.getByRole('button', { name: /Edit.*Member/ }).click();

      const menu = page.getByRole('menu', { name: 'Select an Entry to Edit' });

      await expect.element(menu.getByRole('menuitem').nth(0)).toHaveAccessibleName('Melvin Lucas');
      await expect.element(menu.getByRole('menuitem').nth(1)).toHaveAccessibleName('Elsie Dean');
      await menu.getByRole('menuitem', { name: 'Elsie Dean' }).click();

      await expect
        .element(
          page
            .getByRole('dialog', { name: /Editing.*Member/ })
            .getByRole('textbox', { name: 'Name' }),
        )
        .toHaveValue('Elsie Dean');
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
      await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    });
  });
});
