import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { sidebarSheetPanel } from '$lib/services/contents/editor/sidebar';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import SidebarSheet from './sidebar-sheet.svelte';

vi.mock('$lib/services/contents/entry/history', () => ({
  fetchEntryHistory: vi.fn(async () => ({ commits: [], loading: false, error: false })),
  clearEntryHistoryCache: vi.fn(),
}));

const fields = [{ name: 'title', label: 'Title', widget: 'string', required: true }];

describe('SidebarSheet', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [{ name: 'posts', label: 'Posts', folder: 'content/posts', fields }],
    });
  });

  beforeEach(() => {
    sidebarSheetPanel.current = null;
  });

  test('shows the requested panel, and closes', async () => {
    await renderWithDraft(SidebarSheet, { draft: createMockDraft({ fields }) });

    // Nothing is shown until a panel is requested
    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    sidebarSheetPanel.current = 'history';

    const sheet = page.getByRole('dialog', { name: 'History' });

    await expect.element(sheet).toBeVisible();
    await expect.element(sheet.getByRole('group', { name: 'History' })).toBeInTheDocument();

    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => sidebarSheetPanel.current).toBeNull();
    await expect.poll(() => page.getByRole('dialog').elements().length).toBe(0);
  });

  test('closes when swiped down', async () => {
    await renderWithDraft(SidebarSheet, { draft: createMockDraft({ fields }) });

    sidebarSheetPanel.current = 'validation';
    await expect.element(page.getByRole('dialog', { name: 'Validation' })).toBeVisible();

    const handle = /** @type {HTMLElement} */ (document.querySelector('dialog .handle'));
    const { left, top } = handle.getBoundingClientRect();
    const init = { bubbles: true, pointerId: 1, isPrimary: true, clientX: left };

    handle.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientY: top }));
    handle.dispatchEvent(new PointerEvent('pointermove', { ...init, clientY: top + 400 }));
    handle.dispatchEvent(new PointerEvent('pointerup', { ...init, clientY: top + 400 }));

    await expect.poll(() => sidebarSheetPanel.current).toBeNull();
    await expect.poll(() => page.getByRole('dialog').elements().length).toBe(0);
  });

  test('closes when the panel is cleared elsewhere', async () => {
    await renderWithDraft(SidebarSheet, { draft: createMockDraft({ fields }) });

    sidebarSheetPanel.current = 'validation';
    await expect.element(page.getByRole('dialog', { name: 'Validation' })).toBeVisible();

    sidebarSheetPanel.current = null;
    await expect.poll(() => page.getByRole('dialog').elements().length).toBe(0);
  });

  test('highlights a field once the sheet is closed', async () => {
    const postMessage = vi.spyOn(window, 'postMessage');

    await renderWithDraft(SidebarSheet, {
      draft: createMockDraft({ fields, values: { _default: { title: '' } } }),
    });

    sidebarSheetPanel.current = 'validation';

    const sheet = page.getByRole('dialog', { name: 'Validation' });

    await sheet.getByRole('button', { name: 'Validate' }).click();
    await sheet.getByRole('button', { name: /Title/ }).click();

    // The page behind the sheet is inert until it’s closed, so the field can’t be focused yet
    expect(postMessage).not.toHaveBeenCalled();
    await expect.poll(() => postMessage.mock.calls.length).toBe(1);
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      { type: 'highlight-editor-field', payload: { locale: '_default', keyPath: 'title' } },
      window.location.origin,
    );
  });

  test('reopens when a panel is requested while it’s closing', async () => {
    const postMessage = vi.spyOn(window, 'postMessage');

    await renderWithDraft(SidebarSheet, {
      draft: createMockDraft({ fields, values: { _default: { title: '' } } }),
    });

    sidebarSheetPanel.current = 'validation';

    const sheet = page.getByRole('dialog', { name: 'Validation' });

    await sheet.getByRole('button', { name: 'Validate' }).click();
    await sheet.getByRole('button', { name: /Title/ }).click();

    // The same panel is requested again before the sheet has slid away
    expect(sidebarSheetPanel.current).toBeNull();
    sidebarSheetPanel.current = 'validation';

    await expect.poll(() => document.querySelector('dialog.open')).not.toBeNull();
    await expect.element(sheet).toBeVisible();
    expect(sidebarSheetPanel.current).toBe('validation');
    // The page behind the sheet is inert again, so the field is left alone
    expect(postMessage).not.toHaveBeenCalled();
  });

  test('forgets the panel when the editor goes away', async () => {
    const { unmount } = await renderWithDraft(SidebarSheet, { draft: createMockDraft({ fields }) });

    sidebarSheetPanel.current = 'validation';
    await expect.element(page.getByRole('dialog', { name: 'Validation' })).toBeVisible();

    unmount();
    expect(sidebarSheetPanel.current).toBeNull();
  });
});
