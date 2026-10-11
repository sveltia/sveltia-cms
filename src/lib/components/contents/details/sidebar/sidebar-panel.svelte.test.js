import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { createMockEntry, initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import SidebarPanel from './sidebar-panel.svelte';

vi.mock('$lib/services/contents/entry/history', () => ({
  fetchEntryHistory: vi.fn(async () => ({ commits: [], loading: false, error: false })),
  clearEntryHistoryCache: vi.fn(),
}));

const fields = [{ name: 'title', label: 'Title', widget: 'string', required: true }];

describe('SidebarPanel', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [{ name: 'posts', label: 'Posts', folder: 'content/posts', fields }],
    });
  });

  test.each([
    ['slug', 'Slug'],
    ['history', 'History'],
    ['backlinks', 'Backlinks'],
    ['validation', 'Validation'],
  ])('renders the %s panel', async (key, title) => {
    await renderWithDraft(SidebarPanel, {
      draft: createMockDraft({
        fields,
        draft: { isNew: false, originalEntry: createMockEntry({ slug: 'hello' }) },
      }),
      props: { key },
    });

    await expect.element(page.getByRole('group', { name: title })).toBeInTheDocument();
    // Only the requested panel is rendered
    expect(page.getByRole('heading', { level: 3 }).elements()).toHaveLength(1);
  });

  test('falls back to the Validation panel for an unknown key', async () => {
    await renderWithDraft(SidebarPanel, {
      draft: createMockDraft({ fields }),
      props: { key: 'unknown' },
    });

    await expect.element(page.getByRole('group', { name: 'Validation' })).toBeInTheDocument();
  });

  test('hands a selected field over to the Validation panel’s caller', async () => {
    const onSelectField = vi.fn();
    const postMessage = vi.spyOn(window, 'postMessage');

    await renderWithDraft(SidebarPanel, {
      draft: createMockDraft({ fields, values: { _default: { title: '' } } }),
      props: { key: 'validation', onSelectField },
    });

    await page.getByRole('button', { name: 'Validate' }).click();
    await page.getByRole('button', { name: /Title/ }).click();

    expect(onSelectField).toHaveBeenCalledExactlyOnceWith({ locale: '_default', keyPath: 'title' });
    expect(postMessage).not.toHaveBeenCalled();
  });

  test('highlights a selected field in the editor by default', async () => {
    const postMessage = vi.spyOn(window, 'postMessage');

    await renderWithDraft(SidebarPanel, {
      draft: createMockDraft({ fields, values: { _default: { title: '' } } }),
      props: { key: 'validation' },
    });

    await page.getByRole('button', { name: 'Validate' }).click();
    await page.getByRole('button', { name: /Title/ }).click();

    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      { type: 'highlight-editor-field', payload: { locale: '_default', keyPath: 'title' } },
      window.location.origin,
    );
  });
});
