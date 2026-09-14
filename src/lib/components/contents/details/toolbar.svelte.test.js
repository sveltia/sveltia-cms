import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { allAssetFolders } from '$lib/services/assets/folders';
import { backendName } from '$lib/services/backends';
import { getCollection } from '$lib/services/contents/collection';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { deleteEntries } from '$lib/services/contents/collection/data/delete';
import { nestedFilterPath } from '$lib/services/contents/collection/nested';
import { duplicateDraft } from '$lib/services/contents/draft/create/duplicate';
import { saveEntry } from '$lib/services/contents/draft/save';
import { copyFromLocaleToast } from '$lib/services/contents/editor';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { deployPollTimedOut } from '$lib/services/deployments';
import { recheckDeployments } from '$lib/services/deployments/poll';
import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import { unpublishedEntries } from '$lib/services/workflow';
import {
  deleteWorkflowEntry,
  discardWorkflowEntry,
  updateWorkflowStatus,
} from '$lib/services/workflow/save';
import {
  createMockAsset,
  createMockEntry,
  initTestConfig,
  setAssets,
  setEntries,
} from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import Toolbar from './toolbar.svelte';

vi.mock('$lib/services/contents/draft/save', () => ({ saveEntry: vi.fn() }));
vi.mock('$lib/services/contents/collection/data/delete', () => ({
  updateStores: vi.fn(),
  deleteEntries: vi.fn(),
}));
vi.mock('$lib/services/contents/draft/create/duplicate', () => ({ duplicateDraft: vi.fn() }));
vi.mock('$lib/services/deployments/poll', () => ({
  retainDeployPolling: vi.fn(() => () => {}),
  recheckDeployments: vi.fn(),
}));
vi.mock('$lib/services/workflow/save', () => ({
  getUnpublishedEntryByBranch: vi.fn(),
  upsertUnpublishedEntry: vi.fn(),
  removeUnpublishedEntry: vi.fn(),
  saveWorkflowChanges: vi.fn(),
  updateWorkflowStatus: vi.fn(),
  publishWorkflowEntry: vi.fn(),
  discardWorkflowEntry: vi.fn(),
  deleteWorkflowEntry: vi.fn(),
  discardWorkflowEntries: vi.fn(),
  deleteWorkflowEntries: vi.fn(),
}));

const fields = [{ name: 'title', widget: 'string' }];
const postsCollection = { name: 'posts', label: 'Posts', folder: 'content/posts', fields };
const helloEntry = createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } });

/**
 * Render the toolbar.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @param {Record<string, any>} [props] Props.
 * @returns {Promise<{ draft: any, entryDraft: any }>} Draft and its state.
 */
const renderToolbar = async (draftProps = {}, props = {}) => {
  const draft = createMockDraft({
    fields,
    values: { _default: { title: 'Hello' } },
    draft: { collection: getCollection('posts'), ...draftProps },
  });

  const { entryDraft } = await renderWithDraft(Toolbar, { draft, props });

  return { draft, entryDraft };
};

/**
 * Render the toolbar for an existing entry.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @returns {Promise<{ draft: any, entryDraft: any }>} Draft and its state.
 */
const renderExisting = (draftProps = {}) =>
  renderToolbar({ isNew: false, originalEntry: helloEntry, ...draftProps });

/**
 * Get the text of the toast being shown, if any.
 * @returns {string | undefined} Text.
 */
const getShownToastText = () =>
  document
    .querySelector('.sui.toast:not([aria-hidden="true"])')
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();

/**
 * Open the editor options menu.
 * @returns {Promise<import('vitest/browser').Locator>} Menu.
 */
const openMenu = async () => {
  await page.getByRole('button', { name: 'Show Editor Options' }).click();
  // A Sveltia UI menu starts handling clicks 100 ms after it’s opened
  await sleep(150);

  return page.getByRole('menu', { name: 'Editor Options' });
};

describe('Toolbar', () => {
  beforeEach(async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      collections: [{ ...postsCollection, preview_path: 'posts/{{slug}}' }],
    });
    setEntries([helloEntry]);
    backendName.current = undefined;
    env.isSmallScreen = false;
    env.isLargeScreen = true;
    prefs.closeOnSave = true;
    entryEditorSettings.current = { showPreview: true, showSecondPane: true, syncScrolling: true };
    unpublishedEntries.current = [];
    deployPollTimedOut.current = false;
    contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE };
    copyFromLocaleToast.current = { ...copyFromLocaleToast.current, show: false };
    window.location.hash = '#/collections/posts/new';
    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ (helloEntry));
  });

  test('saves a new entry and goes back to the list', async () => {
    const { draft, entryDraft } = await renderToolbar();
    const toolbar = page.getByRole('toolbar', { name: 'Primary' });

    expect(toolbar.element().querySelector('h2')).toHaveTextContent('Creating \u2068Posts\u2069');

    const save = toolbar.getByRole('button', { name: 'Save' });

    // A new entry can always be saved
    await expect.element(save).toBeEnabled();
    await save.click();

    await vi.waitFor(() => expect(saveEntry).toHaveBeenCalledWith({ draft, skipCI: undefined }));
    await expect.poll(() => window.location.hash).toBe('#/collections/posts');
    expect(entryDraft.current).toBeNull();
  });

  test('keeps the editor open when preferred', async () => {
    prefs.closeOnSave = false;

    const { entryDraft } = await renderToolbar();

    await page.getByRole('button', { name: 'Save' }).click();

    // The URL now points to the saved entry, and the draft is recreated from it
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/hello');
    await expect.poll(() => entryDraft.current?.isNew).toBe(false);
  });

  test('shows the entry title, and saves once modified', async () => {
    const { draft } = await renderExisting();
    const toolbar = page.getByRole('toolbar', { name: 'Primary' });

    expect(toolbar.element().querySelector('h2')).toHaveTextContent('Posts › Hello');
    await expect.element(toolbar.getByRole('button', { name: 'View on Live Site' })).toBeEnabled();

    const save = toolbar.getByRole('button', { name: 'Save' });

    await expect.element(save).toBeDisabled();
    draft.currentValues._default.title = 'Hi';
    await expect.element(save).toBeEnabled();
  });

  test('reports the fields that failed validation', async () => {
    vi.mocked(saveEntry).mockRejectedValue(new Error('validation_failed'));

    await renderToolbar({
      validities: { _default: { title: { valid: false }, body: { valid: false } } },
    });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error 2 fields have errors. Please correct them to save the entry.');
  });

  test('reports a failure to save', async () => {
    vi.mocked(saveEntry).mockRejectedValue(
      new Error('saving_failed', { cause: new Error('Server is down') }),
    );

    await renderToolbar();
    await page.getByRole('button', { name: 'Save' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Error' });

    await expect.element(dialog).toBeInTheDocument();
    expect(dialog.element().textContent).toContain('Server is down');
  });

  test('duplicates the entry once its assets are copied, then opens the duplicate', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(duplicateDraft).mockReturnValue(/** @type {any} */ (promise));
    window.location.hash = '#/collections/posts/entries/hello';

    const { draft } = await renderExisting();

    await (await openMenu()).getByRole('menuitem', { name: 'Duplicate Entry' }).click();
    await vi.waitFor(() => expect(duplicateDraft).toHaveBeenCalledOnce());

    // Copying the assets takes a moment, during which the controls are locked
    const options = page.getByRole('button', { name: 'Show Editor Options' });

    await expect.element(options).toBeDisabled();
    expect(window.location.hash).toBe('#/collections/posts/entries/hello');

    resolve(draft);
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/new');
    await expect.element(options).toBeEnabled();
  });

  test('stays put when the editor is left while duplicating', async () => {
    // The duplication is called off when the draft is gone by the time the assets are copied
    vi.mocked(duplicateDraft).mockResolvedValue(undefined);
    window.location.hash = '#/collections/posts/entries/hello';

    await renderExisting();
    await (await openMenu()).getByRole('menuitem', { name: 'Duplicate Entry' }).click();
    await vi.waitFor(() => expect(duplicateDraft).toHaveBeenCalledOnce());
    await expect.element(page.getByRole('button', { name: 'Show Editor Options' })).toBeEnabled();
    expect(window.location.hash).toBe('#/collections/posts/entries/hello');
  });

  test('offers to duplicate an entry stored as a page bundle', async () => {
    // An entry with assets of its own can be duplicated too, as they’re copied along with it
    await initTestConfig({
      site_url: 'https://example.com',
      collections: [{ ...postsCollection, name: 'bundles', path: '{{slug}}/index' }],
    });

    await renderToolbar({
      isNew: false,
      originalEntry: helloEntry,
      collection: getCollection('bundles'),
    });

    await expect
      .element((await openMenu()).getByRole('menuitem', { name: 'Duplicate Entry' }))
      .toBeEnabled();
  });

  test('offers to duplicate, delete, rename and revert an existing entry', async () => {
    vi.mocked(deleteEntries).mockResolvedValue(undefined);

    const { draft } = await renderExisting();
    const menu = await openMenu();

    // The live site link is in the toolbar on a large screen, not in the menu
    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Duplicate', 'Delete', 'Edit Slug', 'Revert All Changes']);
    await expect.element(menu.getByRole('menuitem', { name: 'Edit Slug' })).toBeEnabled();
    await expect.element(menu.getByRole('menuitem', { name: 'Revert All Changes' })).toBeDisabled();
    // A checked item has a check icon
    expect(
      menu
        .getByRole('menuitemcheckbox')
        .elements()
        .map((el) => el.textContent?.trim().replace(/\s*check$/, '')),
    ).toEqual(['Show Second Pane', 'Show Preview', 'Sync Scrolling']);

    await menu.getByRole('menuitem', { name: 'Duplicate Entry' }).click();
    await vi.waitFor(() => expect(duplicateDraft).toHaveBeenCalled());

    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await (await openMenu()).getByRole('menuitem', { name: 'Delete Entry' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

    await expect
      .element(dialog)
      .toHaveTextContent('Delete Entry Are you sure you want to delete this entry? Delete Cancel');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() => expect(deleteEntries).toHaveBeenCalledWith([helloEntry], []));
    await expect.poll(() => window.location.hash).toBe('#/collections/posts');

    // The draft is left alone, as the list page reports the outcome
    expect(draft.isNew).toBe(false);
  });

  test('opens the slug editor', async () => {
    await renderExisting({ currentSlugs: { _default: 'hello' } });
    await (await openMenu()).getByRole('menuitem', { name: 'Edit Slug' }).click();

    await expect.element(page.getByRole('dialog', { name: 'Edit Slug' })).toBeInTheDocument();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => page.getByRole('dialog').elements().length).toBe(0);
  });

  test('reverts the changes', async () => {
    const { draft } = await renderExisting();

    draft.currentValues._default.title = 'Hi';

    const menu = await openMenu();

    await menu.getByRole('menuitem', { name: 'Revert All Changes' }).click();
    await expect.poll(() => draft.currentValues._default.title).toBe('Hello');
  });

  test('toggles the panes', async () => {
    await renderExisting();

    const menu = await openMenu();

    await menu.getByRole('menuitemcheckbox', { name: 'Show Preview' }).click();
    expect(entryEditorSettings.current?.showPreview).toBe(false);

    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await (await openMenu()).getByRole('menuitemcheckbox', { name: 'Show Second Pane' }).click();
    expect(entryEditorSettings.current?.showSecondPane).toBe(false);

    // The preview and scrolling options need the second pane
    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await expect
      .element((await openMenu()).getByRole('menuitemcheckbox', { name: 'Sync Scrolling' }))
      .toBeDisabled();
  });

  test('limits the options for a new entry', async () => {
    await renderToolbar();

    const menu = await openMenu();

    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Edit Slug', 'Revert All Changes']);
    await expect.element(menu.getByRole('menuitem', { name: 'Edit Slug' })).toBeDisabled();
  });

  test('offers to save without publishing when CI can be skipped', async () => {
    await initTestConfig({
      backend: { name: 'github', repo: 'me/site', skip_ci: false },
      collections: [postsCollection],
    });
    backendName.current = 'github';

    const { draft } = await renderToolbar();

    await page.getByRole('button', { name: 'Publish' }).click();
    await vi.waitFor(() => expect(saveEntry).toHaveBeenCalledWith({ draft, skipCI: undefined }));

    // The split button offers the opposite
    const { draft: anotherDraft } = await renderToolbar();

    await page.getByRole('button', { name: 'More Options' }).last().click();
    await sleep(150);
    await page.getByRole('menuitem', { name: 'Save without Publishing' }).click();
    await vi.waitFor(() =>
      expect(saveEntry).toHaveBeenCalledWith({ draft: anotherDraft, skipCI: true }),
    );
  });

  test('goes back to the collection list for a singleton', async () => {
    await initTestConfig({
      collections: [postsCollection],
      singletons: [{ name: 'about', label: 'About', file: 'content/about.md', fields }],
    });

    const collection = /** @type {any} */ (getCollection('_singletons'));
    const collectionFile = collection?._fileMap?.about;

    await renderToolbar({ collection, collectionFile });
    await page.getByRole('button', { name: 'Cancel Editing' }).click();

    await expect.poll(() => window.location.hash).toBe('#/collections');
  });

  test('reports a failure to delete', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(deleteEntries).mockRejectedValue(new Error('Boom'));

    await renderExisting();
    await (await openMenu()).getByRole('menuitem', { name: 'Delete Entry' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Couldn’t delete the entry. Please try again.');
  });

  test('reports a failure to save without a cause', async () => {
    vi.mocked(saveEntry).mockRejectedValue(new Error('saving_failed'));

    await renderToolbar();
    await page.getByRole('button', { name: 'Save' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Error' });

    await expect.element(dialog).toBeVisible();
    expect(dialog.element().textContent).toContain('saving_failed');
  });

  test('renders a bare toolbar for a missing entry', async () => {
    entryEditorSettings.current = undefined;

    const { container } = await renderWithDraft(Toolbar, { draft: undefined });
    const toolbar = page.getByRole('toolbar', { name: 'Primary' });

    await expect.element(toolbar).toBeVisible();
    expect(container.querySelector('h2')?.textContent?.trim()).toBe('');
    await expect.element(toolbar.getByRole('button', { name: 'Save' })).toBeEnabled();

    // The pane settings fall back to their defaults
    await (await openMenu()).getByRole('menuitemcheckbox', { name: 'Show Second Pane' }).click();
    expect(/** @type {any} */ (entryEditorSettings.current)?.showSecondPane).toBe(false);
  });

  test('closes the editor after saving by default', async () => {
    prefs.closeOnSave = undefined;
    window.location.hash = '#/collections/posts/new';

    const { entryDraft } = await renderToolbar();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => entryDraft.current).toBe(null);
    await expect.poll(() => window.location.hash).toBe('#/collections/posts');
  });

  test('keeps the URL of an existing entry once saved', async () => {
    prefs.closeOnSave = false;
    window.location.hash = '#/collections/posts/entries/hello';

    const { draft } = await renderExisting();

    draft.currentValues._default.title = 'Hi';
    await page.getByRole('button', { name: 'Save' }).click();
    await vi.waitFor(() => expect(saveEntry).toHaveBeenCalledOnce());
    expect(window.location.hash).toBe('#/collections/posts/entries/hello');
  });

  test('labels the buttons while saving and publishing', async () => {
    await initTestConfig({
      backend: { name: 'github', repo: 'me/site', skip_ci: false },
      collections: [postsCollection],
    });
    backendName.current = 'github';

    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(saveEntry).mockReturnValue(/** @type {any} */ (promise));

    await renderToolbar();
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect.element(page.getByRole('button', { name: 'Publishing…' })).toBeInTheDocument();
    resolve(helloEntry);

    // With automatic deployments turned off, the button reads Save instead
    await initTestConfig({
      backend: { name: 'github', repo: 'me/site', skip_ci: true },
      collections: [postsCollection],
    });
    vi.mocked(saveEntry).mockReturnValue(/** @type {any} */ (new Promise(() => {})));
    await renderToolbar();
    await page.getByRole('button', { name: 'More Options' }).last().click();
    await sleep(150);
    await expect.element(page.getByRole('menuitem', { name: 'Save and Publish' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await page.getByRole('button', { name: 'Save' }).last().click();
    await expect.element(page.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });

  test('titles a collection file, which can only be discarded', async () => {
    await initTestConfig({
      collections: [
        postsCollection,
        {
          name: 'pages',
          label: 'Pages',
          files: [{ name: 'about', label: 'About Us', file: 'content/about.md', fields }],
        },
      ],
    });

    const collection = /** @type {any} */ (getCollection('pages'));
    const collectionFile = collection?._fileMap?.about;

    await renderToolbar({
      isNew: false,
      collection,
      collectionFile,
      originalEntry: createMockEntry({ slug: 'about', folder: 'content' }),
    });

    expect(page.getByRole('toolbar').element().querySelector('h2')).toHaveTextContent(
      'Pages › About Us',
    );

    const menu = await openMenu();

    expect(menu.getByRole('menuitem', { name: 'Duplicate Entry' }).elements()).toHaveLength(0);
    expect(menu.getByRole('menuitem', { name: 'Delete Entry' }).elements()).toHaveLength(0);
  });

  test('goes back to the folder being browsed in a nested collection', async () => {
    await initTestConfig({
      collections: [
        {
          ...postsCollection,
          name: 'nested',
          folder: 'content/nested',
          nested: { depth: 3 },
          meta: { path: { widget: 'string' } },
        },
      ],
    });
    nestedFilterPath.current = 'docs';
    window.location.hash = '#/collections/nested/entries/docs/hello';

    try {
      await renderToolbar({
        isNew: false,
        collection: getCollection('nested'),
        originalEntry: createMockEntry({ slug: 'docs/hello', folder: 'content/nested' }),
      });

      // The slug of such an entry is its path, which the slug editor can’t change
      await expect
        .element((await openMenu()).getByRole('menuitem', { name: 'Edit Slug' }))
        .toBeDisabled();
      await userEvent.keyboard('{Escape}');
      await page.getByRole('button', { name: 'Cancel Editing' }).click();
      await expect.poll(() => window.location.hash).toBe('#/collections/nested/filter/docs');
    } finally {
      nestedFilterPath.current = '';
    }
  });

  test('warns about the assets stored alongside the entry when deleting it', async () => {
    vi.mocked(deleteEntries).mockResolvedValue(undefined);
    await initTestConfig({
      // Entry-relative, so the assets go with the entry
      collections: [
        {
          ...postsCollection,
          name: 'bundles',
          media_folder: '',
          fields: [...fields, { name: 'image', widget: 'image' }],
        },
      ],
    });

    const folder = allAssetFolders.current.find(
      ({ collectionName }) => collectionName === 'bundles',
    );

    const entry = createMockEntry({
      slug: 'hello',
      folder: 'content/posts',
      content: { _default: { title: 'Hello', image: 'photo.png' } },
    });

    setEntries([entry]);
    setAssets([
      createMockAsset({ name: 'photo.png', folderPath: 'content/posts', asset: { folder } }),
    ]);

    try {
      await renderToolbar({
        isNew: false,
        collection: getCollection('bundles'),
        originalEntry: entry,
      });
      await (await openMenu()).getByRole('menuitem', { name: 'Delete Entry' }).click();
      await expect
        .element(page.getByRole('alertdialog', { name: 'Delete Entry' }))
        .toHaveTextContent(
          'Delete Entry Are you sure you want to delete this entry and associated assets? Delete Cancel',
        );
    } finally {
      setAssets([]);
    }
  });

  test('reports a copy without a source language', async () => {
    await renderExisting();

    copyFromLocaleToast.current = {
      id: 2,
      show: true,
      status: 'error',
      message: 'copy.none',
      count: 1,
      sourceLanguage: undefined,
    };
    await expect.poll(getShownToastText).toBe('error Nothing to copy.');

    // An unknown language is named by its code
    copyFromLocaleToast.current = {
      id: 3,
      show: true,
      status: 'success',
      message: 'copy.complete',
      count: 1,
      sourceLanguage: 'xx',
    };
    await expect.poll(getShownToastText).toBe('check_circle Field copied from \u2068xx\u2069.');
  });

  test('reports an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(saveEntry).mockRejectedValue(new Error('Unexpected'));

    await renderToolbar();
    await page.getByRole('button', { name: 'Save' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Error' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Error There was an error while saving the entry. Please try again later. OK',
      );
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect.element(page.getByRole('button', { name: 'Show Editor Options' })).toHaveFocus();
  });

  test('does nothing once the draft is gone', async () => {
    const { entryDraft } = await renderToolbar();

    entryDraft.current = null;
    await page.getByRole('button', { name: 'Save' }).click();
    expect(saveEntry).not.toHaveBeenCalled();

    // The menu can still be opened
    await expect
      .element((await openMenu()).getByRole('menuitemcheckbox', { name: 'Sync Scrolling' }))
      .toBeVisible();
  });

  test('offers to check for the preview again once the checks have given up', async () => {
    deployPollTimedOut.current = true;

    await renderExisting();
    await (await openMenu()).getByRole('menuitem', { name: 'Check for Preview' }).click();
    expect(recheckDeployments).toHaveBeenCalled();
  });

  test('offers the second pane for a localized collection', async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
      collections: [{ ...postsCollection, name: 'localized', i18n: true }],
    });

    const draft = createMockDraft({
      collectionName: 'localized',
      fields,
      i18n: { i18nEnabled: true, allLocales: ['en', 'fr'], defaultLocale: 'en' },
      values: { en: { title: 'Hello' }, fr: { title: 'Bonjour' } },
      draft: { collection: getCollection('localized') },
    });

    await renderWithDraft(Toolbar, { draft });

    const menu = await openMenu();

    expect(
      menu
        .getByRole('menuitemcheckbox')
        .elements()
        .map((el) => el.textContent?.trim().replace(/\s*check$/, '')),
    ).toEqual(['Show Second Pane', 'Show Preview', 'Sync Scrolling']);
  });

  test('toggles the scroll syncing', async () => {
    await renderExisting();
    await (await openMenu()).getByRole('menuitemcheckbox', { name: 'Sync Scrolling' }).click();
    expect(entryEditorSettings.current?.syncScrolling).toBe(false);
  });

  test('has nothing to sync without a preview and a second locale', async () => {
    await renderExisting({ canPreview: false });
    await expect
      .element((await openMenu()).getByRole('menuitemcheckbox', { name: 'Sync Scrolling' }))
      .toBeDisabled();
  });

  test('reports the result of copying from another locale', async () => {
    await renderExisting();

    copyFromLocaleToast.current = {
      id: 1,
      show: true,
      status: 'success',
      message: 'copy.complete',
      count: 2,
      sourceLanguage: 'en',
    };
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('check_circle 2 fields copied from \u2068English\u2069.');
  });

  describe('with Editorial Workflow', () => {
    /** @type {any} */
    const unpublishedEntry = {
      ...helloEntry,
      workflow: {
        status: 'draft',
        collectionName: 'posts',
        pullRequest: { number: 1, branch: 'cms/posts/hello' },
      },
    };

    beforeEach(async () => {
      await initTestConfig({
        backend: { name: 'github', repo: 'me/site' },
        publish_mode: 'editorial_workflow',
        collections: [{ ...postsCollection, preview_path: 'posts/{{slug}}' }],
      });
      backendName.current = 'github';
      unpublishedEntries.current = [unpublishedEntry];
      vi.mocked(saveEntry).mockResolvedValue(unpublishedEntry);
      vi.mocked(updateWorkflowStatus).mockResolvedValue(unpublishedEntry);
    });

    test('offers to send a saved draft for review', async () => {
      const { draft } = await renderToolbar();

      await page.getByRole('button', { name: 'Save' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Send for Review' });

      await expect.element(dialog).toBeInTheDocument();
      await dialog.getByRole('button', { name: 'Send for Review' }).click();

      await vi.waitFor(() =>
        expect(updateWorkflowStatus).toHaveBeenCalledWith(unpublishedEntry, 'pending_review'),
      );
      await expect.poll(() => window.location.hash).toBe('#/collections/posts');
      expect(draft).toBeDefined();
    });

    test('can leave the draft as is', async () => {
      await renderToolbar();
      await page.getByRole('button', { name: 'Save' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Later' }).click();

      await expect.poll(() => window.location.hash).toBe('#/collections/posts');
      expect(updateWorkflowStatus).not.toHaveBeenCalled();
    });

    test('shows the status and offers to discard the changes', async () => {
      await renderExisting();

      const toolbar = page.getByRole('toolbar', { name: 'Primary' });

      await expect
        .element(toolbar.getByRole('button', { name: 'Status: \u2068Draft\u2069' }))
        .toBeInTheDocument();
      // The entry is not ready to be published yet
      expect(toolbar.getByRole('button', { name: 'Publish Entry' }).elements()).toHaveLength(0);

      const menu = await openMenu();

      expect(
        menu
          .getByRole('menuitem')
          .elements()
          .map((el) => el.textContent?.trim()),
      ).toEqual(['Duplicate', 'Discard', 'Delete', 'Edit Slug', 'Revert All Changes']);
    });

    test('offers to publish an entry that is ready', async () => {
      unpublishedEntries.current = [
        {
          ...unpublishedEntry,
          workflow: { ...unpublishedEntry.workflow, status: 'pending_publish' },
        },
      ];

      await renderExisting();

      const toolbar = page.getByRole('toolbar', { name: 'Primary' });

      await expect
        .element(toolbar.getByRole('button', { name: 'Status: \u2068Ready\u2069' }))
        .toBeInTheDocument();
      await expect.element(toolbar.getByRole('button', { name: 'Publish Entry' })).toBeEnabled();
    });

    test('reports a failure to send for review', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(updateWorkflowStatus).mockRejectedValue(new Error('Boom'));

      await renderToolbar();
      await page.getByRole('button', { name: 'Save' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Send for Review' }).click();

      await expect
        .element(page.getByRole('alertdialog', { name: 'Error' }))
        .toHaveTextContent(
          'Error There was an error while saving the entry. Please try again later. Couldn’t change the status. Please try again. OK',
        );
      // The editor stays open
      expect(window.location.hash).not.toBe('#/collections/posts');
    });

    test('deletes an unpublished entry by discarding its pull request', async () => {
      // Nothing has been published yet
      setEntries([]);
      vi.mocked(discardWorkflowEntry).mockResolvedValue(undefined);

      await renderExisting();
      await (await openMenu()).getByRole('menuitem', { name: 'Delete Entry' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

      await expect
        .element(dialog)
        .toHaveTextContent(
          'Delete Entry This entry hasn’t been published yet, so deleting it will discard it completely. Delete Cancel',
        );
      await dialog.getByRole('button', { name: 'Delete' }).click();

      await vi.waitFor(() => expect(discardWorkflowEntry).toHaveBeenCalledWith(unpublishedEntry));
      await expect.poll(() => contentUpdatesToast.current.deleted).toBe(true);
      await expect.poll(() => window.location.hash).toBe('#/collections/posts');
    });

    test('proposes the deletion of a published entry', async () => {
      setEntries([helloEntry]);
      vi.mocked(deleteWorkflowEntry).mockResolvedValue(/** @type {any} */ (undefined));

      await renderExisting();
      await (await openMenu()).getByRole('menuitem', { name: 'Delete' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

      await expect.element(dialog).toBeInTheDocument();
      expect(dialog.element().textContent).toContain(
        'It won’t be removed until the deletion is published.',
      );
      await dialog.getByRole('button', { name: 'Delete' }).click();

      await vi.waitFor(() => expect(deleteWorkflowEntry).toHaveBeenCalled());
      await expect.poll(() => contentUpdatesToast.current.deletionPending).toBe(true);
    });

    test('discards the changes to a published entry', async () => {
      setEntries([helloEntry]);
      vi.mocked(discardWorkflowEntry).mockResolvedValue(undefined);

      await renderExisting();
      await (await openMenu()).getByRole('menuitem', { name: 'Discard Changes' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Discard Changes' });

      await expect
        .element(dialog)
        .toHaveTextContent(
          'Discard Changes This entry has unpublished changes. Discarding them will restore the published version. The entry itself won’t be deleted. Discard Cancel',
        );
      await dialog.getByRole('button', { name: 'Discard' }).click();

      await vi.waitFor(() => expect(discardWorkflowEntry).toHaveBeenCalledWith(unpublishedEntry));
      await expect.poll(() => contentUpdatesToast.current.discarded).toBe(true);
    });

    test('offers to cancel a pending deletion, and nothing else', async () => {
      setEntries([helloEntry]);
      unpublishedEntries.current = [
        {
          ...unpublishedEntry,
          workflow: { ...unpublishedEntry.workflow, status: 'pending_deletion' },
        },
      ];
      vi.mocked(discardWorkflowEntry).mockResolvedValue(undefined);

      await renderExisting();

      const toolbar = page.getByRole('toolbar', { name: 'Primary' });

      expect(toolbar.getByRole('button', { name: 'Save' }).elements()).toHaveLength(0);
      expect(toolbar.getByRole('button', { name: /Status/ }).elements()).toHaveLength(0);

      const menu = await openMenu();

      await expect.element(menu.getByRole('menuitem', { name: 'Edit Slug' })).toBeDisabled();
      await menu.getByRole('menuitem', { name: 'Cancel Deletion' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Cancel Deletion' });

      await expect.element(dialog).toBeInTheDocument();
      await dialog.getByRole('button', { name: 'Cancel Deletion' }).click();

      await vi.waitFor(() => expect(discardWorkflowEntry).toHaveBeenCalled());
      await expect.poll(() => contentUpdatesToast.current.deletionCancelled).toBe(true);
    });

    test('moves the actions into the menu on a small screen', async () => {
      env.isSmallScreen = true;
      env.isLargeScreen = false;

      await renderExisting();

      const toolbar = page.getByRole('toolbar', { name: 'Primary' });

      expect(toolbar.element().querySelector('h2')).toBeNull();
      expect(toolbar.getByRole('button', { name: 'View on Live Site' }).elements()).toHaveLength(0);

      const menu = await openMenu();

      expect(
        menu
          .getByRole('menuitem')
          .elements()
          .map((el) => el.textContent?.trim()),
      ).toEqual([
        'View on Live Site',
        'Duplicate',
        'Discard',
        'Delete',
        'Edit Slug',
        'Revert All Changes',
      ]);
      // The pane options are for large screens
      expect(menu.getByRole('menuitemcheckbox').elements()).toHaveLength(0);
    });
  });
});
