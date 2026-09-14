import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { backend, backendName } from '$lib/services/backends';
import { fetchEntryHistory } from '$lib/services/contents/entry/history';
import { openNewTab } from '$lib/services/utils/window';
import { createMockEntry } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import HistoryPanel from './history-panel.svelte';

vi.mock('$lib/services/contents/entry/history', () => ({
  fetchEntryHistory: vi.fn(),
  clearEntryHistoryCache: vi.fn(),
}));
vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));

const entry = createMockEntry({ slug: 'hello' });

/**
 * Render the panel.
 * @returns {Promise<void>}
 */
const renderPanel = async () => {
  await renderWithDraft(HistoryPanel, {
    draft: createMockDraft({ draft: { isNew: false, originalEntry: entry } }),
  });
};

describe('HistoryPanel', () => {
  beforeEach(() => {
    backendName.current = undefined;
  });

  test('lists the commits', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(fetchEntryHistory).mockReturnValue(/** @type {any} */ (promise));

    await renderPanel();

    const panel = page.getByRole('group', { name: 'History' });

    await expect.element(panel.getByText('Loading…')).toBeInTheDocument();
    expect(fetchEntryHistory).toHaveBeenCalledWith(entry);

    resolve({
      commits: [
        {
          sha: 'abc',
          authorName: 'Melvin',
          authorAvatarURL: 'data:,',
          date: new Date('2024-01-15T10:00:00Z'),
        },
        { sha: 'def', authorName: 'Elsie', date: new Date('2024-01-14T10:00:00Z') },
      ],
      error: false,
    });

    const links = panel.getByRole('list').getByRole('link');

    await expect.poll(() => links.elements().length).toBe(2);
    expect(links.elements().map((el) => el.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Melvin Jan 15, 2024, 10:00 AM',
      'Elsie Jan 14, 2024, 10:00 AM',
    ]);
    expect(links.nth(0).element().querySelector('img')).toHaveAttribute('src', 'data:,');
    expect(links.nth(1).element().querySelector('.placeholder')).not.toBeNull();
    // The test backend has no repository to link to
    await expect.element(links.nth(0)).toBeDisabled();
  });

  test('links to the commits on the repository', async () => {
    backendName.current = 'github';

    // The repository info is filled in when the backend is initialized
    const repository = /** @type {any} */ (backend.current?.repository);
    const { commitBaseURL } = repository;

    repository.commitBaseURL = 'https://github.com/me/site/commit';

    vi.mocked(fetchEntryHistory).mockResolvedValue({
      commits: [{ sha: 'abc', authorName: 'Melvin', date: new Date() }],
      loading: false,
      error: false,
    });

    try {
      await renderPanel();

      const link = page.getByRole('link');

      await expect.element(link).toBeEnabled();
      await link.click();
      expect(openNewTab).toHaveBeenCalledWith('https://github.com/me/site/commit/abc');
    } finally {
      repository.commitBaseURL = commitBaseURL;
    }
  });

  test('reports an empty history or a failure', async () => {
    vi.mocked(fetchEntryHistory).mockResolvedValue({ commits: [], loading: false, error: false });
    await renderPanel();
    await expect.element(page.getByText('No history found.')).toBeInTheDocument();

    vi.mocked(fetchEntryHistory).mockResolvedValue({ commits: [], loading: false, error: true });
    await renderPanel();
    await expect.element(page.getByText('Failed to load history.')).toBeInTheDocument();
  });
});
