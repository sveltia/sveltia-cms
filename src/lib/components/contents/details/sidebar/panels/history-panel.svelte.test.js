import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { backend, backendName } from '$lib/services/backends';
import { getCommitMessagePromptMode } from '$lib/services/backends/commit-prompt';
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

vi.mock('$lib/services/backends/commit-prompt', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getCommitMessagePromptMode: vi.fn(),
}));

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
    // The commit messages are only shown with the `prompt_commit_messages` option
    vi.mocked(getCommitMessagePromptMode).mockReturnValue('prefix');
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
          message: 'Update “Hello”',
          authorName: 'Melvin',
          authorAvatarURL: 'data:,',
          date: new Date('2024-01-15T10:00:00Z'),
        },
        // A backend that returns no message
        { sha: 'def', message: '', authorName: 'Elsie', date: new Date('2024-01-14T10:00:00Z') },
      ],
      error: false,
    });

    const links = panel.getByRole('list').getByRole('listitem').getByRole('link');

    await expect.poll(() => links.elements().length).toBe(2);
    expect(links.elements().map((el) => el.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Update “Hello” Melvin Jan 15, 2024, 10:00 AM',
      'Elsie Jan 14, 2024, 10:00 AM',
    ]);

    // The message headline comes first, with the full text in a tooltip
    const message = links.nth(0).element().querySelector('.message');

    expect(message).toHaveTextContent('Update “Hello”');
    expect(message).toHaveAttribute('title', 'Update “Hello”');
    expect(message?.querySelector('bdi')).not.toBeNull();
    expect(message?.nextElementSibling).toHaveClass('meta', 'secondary');
    expect(message?.nextElementSibling).toHaveTextContent('Melvin Jan 15, 2024, 10:00 AM');
    // Without a message, the author and the date are shown as before
    expect(links.nth(1).element().querySelector('.message')).toBeNull();
    expect(links.nth(1).element().querySelector('.meta')).not.toHaveClass('secondary');
    expect(links.nth(0).element().querySelector('img')).toHaveAttribute('src', 'data:,');
    expect(links.nth(1).element().querySelector('.placeholder')).not.toBeNull();
    // The test backend has no repository to link to
    await expect.element(links.nth(0)).toBeDisabled();
  });

  test('hides the commit messages without the commit message prompt', async () => {
    vi.mocked(getCommitMessagePromptMode).mockReturnValue(undefined);

    vi.mocked(fetchEntryHistory).mockResolvedValue({
      commits: [
        {
          sha: 'abc',
          message: 'Update “Hello”',
          authorName: 'Melvin',
          date: new Date('2024-01-15T10:00:00Z'),
        },
      ],
      loading: false,
      error: false,
    });

    await renderPanel();

    const link = page.getByRole('link');

    await expect.element(link).toBeInTheDocument();
    expect(link.element().textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Melvin Jan 15, 2024, 10:00 AM',
    );
    expect(link.element().querySelector('.message')).toBeNull();
    expect(link.element().querySelector('.meta')).not.toHaveClass('secondary');
  });

  test('links to the commits on the repository', async () => {
    backendName.current = 'github';

    // The repository info is filled in when the backend is initialized
    const repository = /** @type {any} */ (backend.current?.repository);
    const { commitBaseURL } = repository;

    repository.commitBaseURL = 'https://github.com/me/site/commit';

    vi.mocked(fetchEntryHistory).mockResolvedValue({
      commits: [{ sha: 'abc', message: 'Add a post', authorName: 'Melvin', date: new Date() }],
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
