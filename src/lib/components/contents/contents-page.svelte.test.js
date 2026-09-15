import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { announcedPageStatus } from '$lib/services/app/navigation';
import { backendName } from '$lib/services/backends';
import { selectedCollection } from '$lib/services/contents/collection';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { entryListSettings } from '$lib/services/contents/collection/view/settings';
import { showContentOverlay } from '$lib/services/contents/editor';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { searchMode, searchTerms } from '$lib/services/search';
import { env } from '$lib/services/user/env.svelte';
import { unpublishedEntries, unpublishedEntriesLoaded } from '$lib/services/workflow';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import ContentsPage from './contents-page.svelte';

vi.mock('$lib/services/deployments/poll', () => ({
  retainDeployPolling: vi.fn(() => () => {}),
  recheckDeployments: vi.fn(),
}));
vi.mock('$lib/services/contents/draft/backup', async () => {
  const { createDeepState } = await import('$lib/services/utils/state.svelte');

  return {
    restoreDialogState: createDeepState({ show: false }),
    backupToastState: createDeepState({ saved: false, restored: false, deleted: false }),
    deleteBackup: vi.fn(),
    getBackup: vi.fn(),
    saveBackup: vi.fn(),
    restoreBackup: vi.fn(),
    restoreBackupIfNeeded: vi.fn(),
    showBackupToastIfNeeded: vi.fn(),
    resetBackupToastState: vi.fn(),
    scheduleBackup: vi.fn(),
  };
});

const fields = [{ name: 'title', widget: 'string' }];

describe('ContentsPage', () => {
  beforeEach(async () => {
    await initTestConfig({
      collections: [
        { name: 'posts', label: 'Posts', folder: 'content/posts', fields },
        {
          name: 'pages',
          label: 'Pages',
          files: [{ name: 'about', label: 'About Us', file: 'content/about.md', fields }],
        },
      ],
    });
    setEntries([
      createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } }),
      createMockEntry({ slug: 'world', content: { _default: { title: 'World' } } }),
    ]);
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    env.isLargeScreen = true;
    entryListSettings.current = { posts: { type: 'list' } };
    entryEditorSettings.current = { showPreview: true, showSecondPane: true };
    selectedCollection.current = undefined;
    showContentOverlay.current = false;
    contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE };
    backendName.current = undefined;
  });

  test('lists the entries of the collection in the URL', async () => {
    window.location.hash = '#/collections/posts';

    await render(ContentsPage);

    const library = page.getByRole('group', { name: 'Content Library' });

    await expect.element(library.getByRole('tree', { name: 'Collection List' })).toBeVisible();

    const area = library.getByRole('main', { name: '“\u2068Posts\u2069” Collection' });

    await expect
      .poll(() => area.getByRole('grid', { name: 'Entries' }).getByRole('row').elements().length)
      .toBe(2);
    await expect.element(area.getByRole('toolbar', { name: 'Entry List' })).toBeInTheDocument();
    expect(announcedPageStatus.current).toBe(
      'You’re now viewing the “\u2068Posts\u2069” collection, which has 2 entries.',
    );

    // Following the URL to a file collection
    window.location.hash = '#/collections/pages';
    await expect
      .element(page.getByRole('main', { name: '“\u2068Pages\u2069” Collection' }))
      .toBeInTheDocument();
    expect(selectedCollection.current?.name).toBe('pages');
  });

  test('redirects the index to the first collection on a large screen', async () => {
    window.location.hash = '#/collections';

    await render(ContentsPage);
    await expect.poll(() => window.location.hash).toBe('#/collections/posts');
  });

  test('shows the collection list alone on a small screen', async () => {
    env.isSmallScreen = true;
    env.isLargeScreen = false;
    window.location.hash = '#/collections';

    await render(ContentsPage);

    await expect.element(page.getByRole('tree', { name: 'Collection List' })).toBeVisible();
    expect(announcedPageStatus.current).toBe('You’re now viewing the collection list.');
    expect(page.getByRole('grid').elements()).toHaveLength(0);
  });

  test('opens the editor for an entry', async () => {
    window.location.hash = '#/collections/posts/entries/hello';

    await render(ContentsPage);

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect.element(editor).toBeInTheDocument();
    await expect.element(editor.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');
    expect(showContentOverlay.current).toBe(true);

    // Closing the editor
    await editor.getByRole('button', { name: 'Cancel Editing' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts');
    await expect.poll(() => showContentOverlay.current).toBe(false);
  });

  test('waits for the drafts before opening a deep link with Editorial Workflow', async () => {
    await initTestConfig({
      backend: { name: 'github', repo: 'me/site' },
      publish_mode: 'editorial_workflow',
      collections: [{ name: 'posts', label: 'Posts', folder: 'content/posts', fields }],
    });
    setEntries([createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } })]);
    backendName.current = 'github';
    unpublishedEntries.current = [];
    unpublishedEntriesLoaded.current = false;
    window.location.hash = '#/collections/posts/entries/hello';

    try {
      await render(ContentsPage);
      await expect.poll(() => announcedPageStatus.current).toBe('Loading entry…');

      // The entry is resolved once the drafts are in
      unpublishedEntriesLoaded.current = true;
      await expect
        .element(page.getByRole('group', { name: 'Content Editor' }).getByRole('textbox'))
        .toHaveValue('Hello');
    } finally {
      unpublishedEntriesLoaded.current = false;
    }
  });

  test('opens the editor for a new entry, and a collection file', async () => {
    window.location.hash = '#/collections/posts/new';

    const { container } = await render(ContentsPage);

    await expect.element(page.getByRole('group', { name: 'Content Editor' })).toBeInTheDocument();
    expect(container.querySelector('.content-editor h2')).toHaveTextContent(
      'Creating \u2068Posts\u2069',
    );

    // The collection file hasn’t been created yet, so it’s a new entry as well
    window.location.hash = '#/collections/pages/entries/about';
    await expect
      .poll(() => container.querySelector('.content-editor h2')?.textContent)
      .toBe('Creating \u2068Pages\u2069');
    expect(selectedCollection.current?.name).toBe('pages');
  });

  test('reports a missing collection or page', async () => {
    window.location.hash = '#/collections/missing';

    await render(ContentsPage);
    await expect.element(page.getByText('Collection not found.')).toBeInTheDocument();
    expect(announcedPageStatus.current).toBe('Collection not found.');

    window.location.hash = '#/collections/posts/foo/bar';
    await expect.element(page.getByText('Page not found.')).toBeInTheDocument();
  });

  test('shows the search results', async () => {
    searchMode.current = 'contents';
    searchTerms.current = 'hello';
    window.location.hash = '#/search/hello';

    await render(ContentsPage);

    await expect.element(page.getByRole('toolbar')).toHaveTextContent('Search Results');
    await expect
      .element(page.getByRole('grid', { name: 'Entries' }).getByRole('row', { name: /Hello/ }))
      .toBeInTheDocument();
  });

  test('reports the content updates', async () => {
    window.location.hash = '#/collections/posts';

    await render(ContentsPage);

    contentUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      count: 2,
      saved: true,
      published: true,
    };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success 2 entries saved and published.');
    // The toast goes away on its own, resetting the state
    await waitForToastsToHide();
    expect(contentUpdatesToast.current.saved).toBe(false);

    contentUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      count: 1,
      deleted: true,
      deletionPending: true,
    };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Entry marked for deletion.');
    await waitForToastsToHide();

    contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, count: 1, discarded: true };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Changes discarded.');
    await waitForToastsToHide();

    contentUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      count: 1,
      deletionCancelled: true,
    };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Deletion cancelled.');
    await waitForToastsToHide();
  }, 40000);
});
