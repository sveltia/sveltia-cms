import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
import {
  editorFirstPane,
  editorSecondPane,
  showContentOverlay,
  showDuplicateToast,
} from '$lib/services/contents/editor';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';
import { createMockDraft } from '$lib/test/draft';
import { waitForToastsToHide } from '$lib/test/toast';

import ContentDetailsOverlay from './content-details-overlay.svelte';

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

const fields = [
  { name: 'title', label: 'Title', widget: 'string', i18n: true },
  { name: 'body', label: 'Body', widget: 'text', i18n: true },
  {
    name: 'author',
    label: 'Author',
    widget: 'object',
    i18n: true,
    fields: [{ name: 'name', label: 'Name', widget: 'string', i18n: true }],
  },
];

/**
 * Render the overlay.
 * @param {any} draft Draft, `undefined` for a missing entry.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<{ entryDraft: EntryDraftState, container: HTMLElement }>} Draft state and
 * container.
 */
const renderOverlay = async (draft, props = {}) => {
  const entryDraft = new EntryDraftState();

  entryDraft.current = draft;

  const { container } = await render(ContentDetailsOverlay, { entryDraft, ...props });

  return { entryDraft, container };
};

/**
 * Create a draft of a new post.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @returns {any} Draft.
 */
const createDraft = (draftProps = {}) =>
  createMockDraft({
    fields,
    i18n: {
      i18nEnabled: true,
      allLocales: ['en', 'fr', 'de'],
      initialLocales: ['en', 'fr', 'de'],
      defaultLocale: 'en',
      structure: /** @type {const} */ ('multiple_folders'),
    },
    values: {
      en: { title: 'Hello', body: '', 'author.name': 'Melvin' },
      fr: { title: 'Bonjour', body: '', 'author.name': 'Melvin' },
      de: { title: 'Hallo', body: '', 'author.name': 'Melvin' },
    },
    draft: { collection: getCollection('posts'), ...draftProps },
  });

describe('ContentDetailsOverlay', () => {
  beforeEach(async () => {
    await initTestConfig({
      i18n: {
        structure: /** @type {const} */ ('multiple_folders'),
        locales: ['en', 'fr', 'de'],
        default_locale: 'en',
      },
      collections: [
        { name: 'posts', label: 'Posts', folder: 'content/posts', i18n: true, fields },
        { name: 'locked', label: 'Locked', folder: 'content/locked', create: false, fields },
        { name: 'limited', label: 'Limited', folder: 'content/limited', limit: 1, fields },
      ],
    });
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    env.isLargeScreen = true;
    showContentOverlay.current = true;
    showDuplicateToast.current = false;
    editorFirstPane.current = null;
    editorSecondPane.current = null;
    entryEditorSettings.current = { showPreview: true, showSecondPane: true, syncScrolling: true };
    selectedCollection.current = getCollection('posts');
    prefs.devModeEnabled = false;
    window.history.replaceState(null, '');
  });

  test('shows the editor and the preview side by side', async () => {
    const { container } = await renderOverlay(createDraft());
    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect.element(editor.getByRole('toolbar', { name: 'Primary' })).toBeInTheDocument();

    const editPane = editor.getByRole('group', { name: 'Edit \u2068English\u2069 Content' });
    const previewPane = editor.getByRole('group', { name: 'Preview \u2068English\u2069 Content' });

    await expect.element(editPane).toHaveAttribute('data-mode', 'edit');
    await expect.element(previewPane).toHaveAttribute('data-mode', 'preview');
    await expect.element(editPane.getByRole('textbox', { name: 'Title' })).toHaveValue('Hello');
    await expect
      .element(previewPane.getByRole('document', { name: 'Content Preview' }))
      .toHaveTextContent('Title HelloBody Author Name Melvin');
    await expect
      .element(editor.getByRole('radiogroup', { name: 'Sidebar Panels' }))
      .toBeInTheDocument();
    // The editor takes the focus
    await expect
      .poll(() => document.activeElement)
      .toBe(container.querySelector('.content-editor'));

    // The panes can be swapped
    await editor.getByRole('button', { name: 'Swap Panes' }).click();
    expect(editorFirstPane.current).toEqual({ mode: 'preview', locale: 'en' });
    expect(editorSecondPane.current).toEqual({ mode: 'edit', locale: 'en' });
  });

  test('shows the other locale in the second pane without the preview', async () => {
    entryEditorSettings.current = { showPreview: false, showSecondPane: true };

    await renderOverlay(createDraft());

    await expect
      .element(
        page
          .getByRole('group', { name: 'Edit \u2068French\u2069 Content' })
          .getByRole('textbox', { name: 'Title' }),
      )
      .toHaveValue('Bonjour');
  });

  test('shows a single pane on a small screen, without the sidebar', async () => {
    env.isSmallScreen = true;
    env.isLargeScreen = false;

    await renderOverlay(createDraft());

    await expect
      .element(page.getByRole('group', { name: 'Edit \u2068English\u2069 Content' }))
      .toBeInTheDocument();
    expect(page.getByRole('group', { name: /Preview/ }).elements()).toHaveLength(0);
    expect(page.getByRole('radiogroup', { name: 'Sidebar Panels' }).elements()).toHaveLength(0);
  });

  test('starts with the requested locale', async () => {
    await renderOverlay(createDraft(), { editorLocale: 'de' });

    await expect
      .element(page.getByRole('group', { name: 'Edit \u2068German\u2069 Content' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('group', { name: 'Preview \u2068German\u2069 Content' }))
      .toBeInTheDocument();
  });

  test('highlights a field on request', async () => {
    await renderOverlay(createDraft());
    await expect.element(page.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();

    window.postMessage(
      { type: 'highlight-editor-field', payload: { locale: 'fr', keyPath: 'body' } },
      window.location.origin,
    );

    // The French content is brought into an edit pane, and the field focused
    await expect
      .element(page.getByRole('group', { name: 'Edit \u2068French\u2069 Content' }))
      .toBeInTheDocument();
    await expect
      .element(
        page
          .getByRole('group', { name: 'Edit \u2068French\u2069 Content' })
          .getByRole('textbox', { name: 'Body' }),
      )
      .toHaveFocus();

    // A field within a collapsed object is expanded first
    await page
      .getByRole('group', { name: 'Edit \u2068French\u2069 Content' })
      .getByRole('button', { name: 'Collapse' })
      .click();
    window.postMessage(
      { type: 'highlight-editor-field', payload: { locale: 'fr', keyPath: 'author.name' } },
      window.location.origin,
    );
    await expect
      .element(
        page
          .getByRole('group', { name: 'Edit \u2068French\u2069 Content' })
          .getByRole('textbox', { name: 'Name' }),
      )
      .toHaveFocus();
  });

  test('marks the draft as interacted', async () => {
    const { entryDraft } = await renderOverlay(createDraft());

    expect(entryDraft.current?.interacted).toBe(false);

    const title = page.getByRole('textbox', { name: 'Title' });

    await expect.element(title).toBeInTheDocument();
    // A synthetic event, like one from a script, doesn’t count as an interaction
    title.element().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(entryDraft.current?.interacted).toBe(false);
    await title.click();
    expect(entryDraft.current?.interacted).toBe(true);
  });

  test('reports a missing entry', async () => {
    window.location.hash = '#/collections/posts/entries/missing';
    entryEditorSettings.current = undefined;

    await renderOverlay(undefined);

    await expect.element(page.getByText('Entry not found.')).toBeInTheDocument();
    await page.getByRole('button', { name: 'Back to Collection' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts');

    // Without a collection to go back to, the collection list is shown
    selectedCollection.current = undefined;
    await renderOverlay(undefined);
    await page.getByRole('button', { name: 'Back to Collection' }).nth(1).click();
    await expect.poll(() => window.location.hash).toBe('#/collections');
  });

  test('shows a loading state', async () => {
    await renderOverlay(createDraft(), { loading: true });

    await expect.element(page.getByText('Loading entry…')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('refuses to create an entry when disabled', async () => {
    selectedCollection.current = getCollection('locked');

    await renderOverlay(
      createMockDraft({
        collectionName: 'locked',
        fields,
        draft: { collection: getCollection('locked') },
      }),
    );

    await expect
      .element(
        page.getByText('Creating new entries in this collection is disabled by the administrator.'),
      )
      .toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('drops the draft when the overlay is closed', async () => {
    showContentOverlay.current = false;

    const { entryDraft } = await renderOverlay(createDraft());

    expect(entryDraft.current).toBeNull();
  });

  test('reports a duplicated entry', async () => {
    await renderOverlay(createDraft());

    showDuplicateToast.current = true;
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('check_circle Entry duplicated as a new draft.');
    // The toast goes away on its own, resetting the state
    await waitForToastsToHide();
    expect(showDuplicateToast.current).toBe(false);
  });

  test('swaps the panes with the keyboard, but not after dragging the handle', async () => {
    await renderOverlay(createDraft());

    const button = page.getByRole('button', { name: 'Swap Panes' });

    await expect.element(button).toBeInTheDocument();

    // A keyboard activation has no pointer position
    button.element().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(editorFirstPane.current).toEqual({ mode: 'preview', locale: 'en' });

    // Activating the handle itself does nothing
    const handle = /** @type {HTMLElement} */ (button.element().parentElement);

    handle.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(editorFirstPane.current).toEqual({ mode: 'preview', locale: 'en' });

    // The handle captures the pointer, which a synthetic event doesn’t have
    handle.setPointerCapture = vi.fn();

    // A drag doesn’t count as a click
    button
      .element()
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    handle.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 40, clientY: 10 }),
    );
    expect(editorFirstPane.current).toEqual({ mode: 'preview', locale: 'en' });

    // A click without a drag swaps the panes back
    button
      .element()
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    handle.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 12, clientY: 11 }),
    );
    expect(editorFirstPane.current).toEqual({ mode: 'edit', locale: 'en' });
  });

  test('remembers the pane widths once resized', async () => {
    await renderOverlay(createDraft());

    const button = page.getByRole('button', { name: 'Swap Panes' });

    await expect.element(button).toBeInTheDocument();

    const handle = /** @type {HTMLElement} */ (button.element().parentElement);

    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();

    // Drag the handle to the right
    handle.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, screenX: 100, screenY: 10 }),
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, pointerId: 1, screenX: 140, screenY: 10 }),
    );
    document.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, pointerId: 1, screenX: 140, screenY: 10 }),
    );

    await expect.poll(() => editorFirstPane.current?.width).toBeGreaterThan(50);
    expect(editorSecondPane.current?.width).toBeLessThan(50);
  });

  test('restores the saved panes', async () => {
    entryEditorSettings.current = {
      showPreview: true,
      showSecondPane: true,
      paneStates: {
        posts: [
          { mode: 'edit', locale: 'fr' },
          { mode: 'edit', locale: 'de' },
        ],
      },
    };

    await renderOverlay(createDraft());

    await expect
      .element(page.getByRole('group', { name: 'Edit \u2068French\u2069 Content' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('group', { name: 'Edit \u2068German\u2069 Content' }))
      .toBeInTheDocument();
  });

  test('shows only the requested locale on a small screen', async () => {
    env.isSmallScreen = true;
    env.isLargeScreen = false;

    await renderOverlay(createDraft(), { editorLocale: 'de' });

    await expect
      .element(page.getByRole('group', { name: 'Edit \u2068German\u2069 Content' }))
      .toBeInTheDocument();
    expect(editorSecondPane.current).toBeNull();
  });

  test('highlights the field named in the history state', async () => {
    window.history.replaceState({ highlight: { locale: 'de', keyPath: 'body' } }, '');

    await renderOverlay(createDraft());

    await expect
      .element(
        page
          .getByRole('group', { name: 'Edit \u2068German\u2069 Content' })
          .getByRole('textbox', { name: 'Body' }),
      )
      .toHaveFocus();
    expect(window.history.state.highlight).toBeNull();
  });

  test('highlights a field that is already visible, ignoring foreign messages', async () => {
    await renderOverlay(createDraft());

    const title = page
      .getByRole('group', { name: 'Edit \u2068English\u2069 Content' })
      .getByRole('textbox', { name: 'Title' });

    await expect.element(title).toBeInTheDocument();

    // A message from another window is ignored
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'highlight-editor-field', payload: { locale: 'en', keyPath: 'title' } },
        source: null,
      }),
    );
    await expect.element(title).not.toHaveFocus();

    window.postMessage(
      { type: 'highlight-editor-field', payload: { locale: 'en', keyPath: 'title' } },
      window.location.origin,
    );
    await expect.element(title).toHaveFocus();

    // Other messages, and a field that isn’t there, are ignored
    title.element().blur();
    window.postMessage({ type: 'something-else' }, window.location.origin);
    window.postMessage(
      { type: 'highlight-editor-field', payload: { locale: 'en', keyPath: 'missing' } },
      window.location.origin,
    );
    window.postMessage(
      { type: 'highlight-editor-field', payload: { locale: 'xx', keyPath: 'title' } },
      window.location.origin,
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
    await expect.element(title).not.toHaveFocus();
  });

  test('renders no pane until the panes are set up', async () => {
    const { container } = await renderOverlay(createDraft());

    await expect.element(page.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
    editorFirstPane.current = null;
    editorSecondPane.current = null;
    await expect.poll(() => container.querySelectorAll('.pane').length).toBe(0);
  });

  test('logs the draft in developer mode', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    prefs.devModeEnabled = true;

    const draft = createDraft({
      files: { 'blob:x': { file: new File(['x'], 'x.png'), folder: undefined } },
    });

    await renderOverlay(draft);
    expect(info).toHaveBeenCalledWith('entryDraft', draft);
  });

  test('refuses to create an entry over the limit', async () => {
    selectedCollection.current = getCollection('limited');
    setEntries([createMockEntry({ slug: 'only', folder: 'content/limited' })]);

    try {
      await renderOverlay(
        createMockDraft({
          collectionName: 'limited',
          fields,
          draft: { collection: getCollection('limited') },
        }),
      );

      await expect
        .element(
          page.getByText(
            'You cannot add new entries to this collection because it has reached its limit of 1 entries.',
          ),
        )
        .toBeInTheDocument();
    } finally {
      setEntries([]);
    }
  });

  test('shows the second pane alone', async () => {
    await renderOverlay(createDraft());
    await expect.element(page.getByRole('button', { name: 'Swap Panes' })).toBeInTheDocument();

    editorFirstPane.current = null;
    editorSecondPane.current = { mode: 'preview', locale: 'fr' };
    await expect
      .element(page.getByRole('group', { name: 'Preview \u2068French\u2069 Content' }))
      .toBeInTheDocument();
    expect(page.getByRole('button', { name: 'Swap Panes' }).elements()).toHaveLength(0);
  });
});
