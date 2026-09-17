import { sleep } from '@sveltia/utils/misc';
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
    vi.mocked(hasCreationRoom).mockReturnValue(true);
  });

  test('offers the referenced entries as sorted options', async () => {
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
    // A Sveltia UI group starts handling clicks 100 ms after it’s mounted
    await sleep(150);

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

    await expect.element(radios.nth(0)).toHaveAccessibleName('Elsie Dean');
    await expect.element(radios.nth(1)).toHaveAccessibleName('Melvin Lucas');
    await expect.element(radios.nth(1)).toBeChecked();

    await radios.nth(0).click();
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
    await sleep(150);
    expect(getOptions).toHaveBeenLastCalledWith(expect.objectContaining({ currentSlug: 'shared' }));
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
  });
});
