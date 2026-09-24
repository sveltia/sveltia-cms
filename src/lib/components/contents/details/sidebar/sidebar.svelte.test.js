import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { backendName } from '$lib/services/backends';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { createMockEntry, initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import Sidebar from './sidebar.svelte';

vi.mock('$lib/services/contents/entry/history', () => ({
  fetchEntryHistory: vi.fn(async () => ({ commits: [], loading: false, error: false })),
  clearEntryHistoryCache: vi.fn(),
}));

describe('Sidebar', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'tags',
          label: 'Tags',
          folder: 'content/tags',
          fields: [{ name: 'name', widget: 'string' }],
        },
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'tag', widget: 'relation', collection: 'tags', value_field: '{{slug}}' },
          ],
        },
      ],
    });
  });

  beforeEach(() => {
    backendName.current = undefined;
    entryEditorSettings.current = { ...entryEditorSettings.current, sidebarPanel: null };
  });

  test('offers the panels as tabs, remembering the choice', async () => {
    backendName.current = 'github';

    await renderWithDraft(Sidebar, {
      draft: createMockDraft({
        collectionName: 'tags',
        draft: { isNew: false, originalEntry: createMockEntry({ slug: 'svelte' }) },
      }),
    });

    const tabs = page.getByRole('radiogroup', { name: 'Sidebar Panels' });

    // No panel exists yet, so there is nothing for the tabs to control
    await expect.element(tabs).not.toHaveAttribute('aria-controls');
    expect(
      tabs
        .getByRole('radio')
        .elements()
        .map((el) => el.getAttribute('aria-label')),
    ).toEqual(['Slug', 'Validation', 'History', 'Backlinks']);
    // No panel is open by default
    expect(page.getByRole('group', { name: 'Validation' }).elements()).toHaveLength(0);

    await tabs.getByRole('radio', { name: 'History' }).click();
    await expect.element(page.getByRole('group', { name: 'History' })).toBeInTheDocument();
    await expect.element(tabs).toHaveAttribute('aria-controls', 'entry-sidebar-content');
    expect(entryEditorSettings.current?.sidebarPanel).toBe('history');

    await tabs.getByRole('radio', { name: 'Backlinks' }).click();
    await expect.element(page.getByRole('group', { name: 'Backlinks' })).toBeInTheDocument();

    // Clicking the active tab closes the panel
    await tabs.getByRole('radio', { name: 'Backlinks' }).click();
    await expect.poll(() => page.getByRole('group').elements().length).toBe(0);
    expect(entryEditorSettings.current?.sidebarPanel).toBeNull();
  });

  test('opens the Slug panel for a new entry whose slug has to be typed in', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, sidebarPanel: 'validation' };

    const draft = createMockDraft({
      collectionName: 'tags',
      draft: { slugEditor: { _default: true }, currentSlugs: { _default: '' } },
    });

    /** @type {any} */ (draft.collection).slug = { editable: true };

    await renderWithDraft(Sidebar, { draft });

    const tabs = page.getByRole('radiogroup', { name: 'Sidebar Panels' });

    await expect.element(page.getByRole('group', { name: 'Slug' })).toBeInTheDocument();
    await expect.element(tabs.getByRole('radio', { name: 'Slug' })).toBeChecked();
    // Without being remembered
    expect(entryEditorSettings.current?.sidebarPanel).toBe('validation');

    // Choosing a panel takes over
    await tabs.getByRole('radio', { name: 'Validation' }).click();
    await expect.element(page.getByRole('group', { name: 'Validation' })).toBeInTheDocument();

    // So does opening a panel elsewhere, once the Slug panel is shown again
    await tabs.getByRole('radio', { name: 'Slug' }).click();
    await expect.element(page.getByRole('group', { name: 'Slug' })).toBeInTheDocument();
    entryEditorSettings.current = { ...entryEditorSettings.current, sidebarPanel: 'history' };
    await expect.element(page.getByRole('group', { name: 'History' })).toBeInTheDocument();
  });

  test('closes the Slug panel opened for a new entry with its tab', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, sidebarPanel: null };

    const draft = createMockDraft({
      collectionName: 'tags',
      draft: { slugEditor: { _default: true }, currentSlugs: { _default: '' } },
    });

    /** @type {any} */ (draft.collection).slug = { editable: true };

    await renderWithDraft(Sidebar, { draft });

    const tabs = page.getByRole('radiogroup', { name: 'Sidebar Panels' });

    await expect.element(page.getByRole('group', { name: 'Slug' })).toBeInTheDocument();
    await tabs.getByRole('radio', { name: 'Slug' }).click();
    await expect.poll(() => page.getByRole('group', { name: 'Slug' }).elements()).toHaveLength(0);
  });

  test('opens the remembered panel', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, sidebarPanel: 'validation' };

    await renderWithDraft(Sidebar, { draft: createMockDraft() });
    await expect.element(page.getByRole('group', { name: 'Validation' })).toBeInTheDocument();
  });

  test('opens the panel chosen elsewhere', async () => {
    await renderWithDraft(Sidebar, { draft: createMockDraft() });
    expect(page.getByRole('group').elements()).toHaveLength(0);

    // E.g. with the Show Errors button on the validation toast
    entryEditorSettings.current = { ...entryEditorSettings.current, sidebarPanel: 'validation' };
    await expect.element(page.getByRole('group', { name: 'Validation' })).toBeInTheDocument();
    await expect.element(page.getByRole('radio', { name: 'Validation' })).toBeChecked();
  });

  test('disables the panels that don’t apply', async () => {
    // A new entry in a collection nothing refers to, with a backend that has no history
    await renderWithDraft(Sidebar, { draft: createMockDraft() });

    await expect.element(page.getByRole('radio', { name: 'Validation' })).toBeEnabled();
    await expect.element(page.getByRole('radio', { name: 'History' })).toBeDisabled();
    await expect.element(page.getByRole('radio', { name: 'Backlinks' })).toBeDisabled();
  });

  test('falls back to the Validation panel when the remembered one is unknown', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, sidebarPanel: 'unknown' };

    await renderWithDraft(Sidebar, { draft: createMockDraft() });
    await expect.element(page.getByRole('group', { name: 'Validation' })).toBeInTheDocument();
  });
});
