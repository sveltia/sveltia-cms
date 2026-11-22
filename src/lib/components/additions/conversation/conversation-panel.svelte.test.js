import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { additionsComments } from '$lib/services/additions/comments.svelte';
import { getConversationAliasKeys } from '$lib/services/additions/conversation-aliases';
import {
  conversations,
  loadConversation,
  loadOlderComments,
  removeComment,
  sendComment,
  updateComment,
} from '$lib/services/additions/conversation.svelte';
import { getDraftEntryKey } from '$lib/services/contents/entry/entry-key';
import { createMockEntry } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ConversationPanel from './conversation-panel.svelte';

// The state is real; loading and writing would talk to the service
vi.mock('$lib/services/additions/conversation.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  loadConversation: vi.fn(),
  loadOlderComments: vi.fn(),
  sendComment: vi.fn(),
  updateComment: vi.fn(),
  removeComment: vi.fn(),
}));

vi.mock('$lib/services/additions/conversation-aliases', () => ({
  getConversationAliasKeys: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/entry/entry-key', async (importOriginal) => ({
  ...(await importOriginal()),
  getDraftEntryKey: vi.fn(),
}));

const KEY = 'posts/hello';

/**
 * Create a comment.
 * @param {Record<string, any>} overrides Values to change.
 * @returns {any} Comment.
 */
const createItem = (overrides) => ({
  id: 'c1',
  body: 'Hello **there**',
  author: { name: 'Ada', login: 'ada', isSelf: false },
  createdDate: new Date('2026-10-13T00:00:00Z'),
  updatedDate: new Date('2026-10-13T00:00:00Z'),
  canEdit: false,
  canDelete: false,
  ...overrides,
});

/**
 * Render the panel with a loaded conversation.
 * @param {Record<string, any>} [state] Conversation state.
 * @returns {Promise<void>}
 */
const renderPanel = async (state = {}) => {
  vi.mocked(getDraftEntryKey).mockReturnValue(KEY);
  vi.mocked(loadConversation).mockImplementation(async () => {
    conversations.entries[KEY] = {
      loading: false,
      loaded: true,
      error: '',
      comments: [],
      hasMore: false,
      ...state,
    };
  });

  await renderWithDraft(ConversationPanel, {
    draft: createMockDraft({
      draft: { isNew: false, originalEntry: createMockEntry({ slug: 'hello' }) },
    }),
  });
};

describe('ConversationPanel', () => {
  beforeEach(() => {
    Object.assign(conversations, { entries: {}, drafts: {} });
    Object.assign(additionsComments, { counts: {}, versions: {} });
  });

  test('loads the older comments of a long conversation, and says why it couldn’t', async () => {
    await renderPanel({ comments: [createItem({})], hasMore: true });

    vi.mocked(loadOlderComments).mockRejectedValueOnce(
      new Error('Network', { cause: { message: 'The service can’t be reached.' } }),
    );
    await page.getByRole('button', { name: 'Show Older Comments' }).click();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The service can’t be reached.');
    expect(loadOlderComments).toHaveBeenCalledWith(KEY);

    vi.mocked(loadOlderComments).mockImplementationOnce(async () => {
      conversations.entries[KEY].hasMore = false;
    });
    await page.getByRole('button', { name: 'Show Older Comments' }).click();
    await expect
      .element(page.getByRole('button', { name: 'Show Older Comments' }))
      .not.toBeInTheDocument();
  });

  test('says when there are no comments yet, and loads again on request', async () => {
    await renderPanel();

    const panel = page.getByRole('group', { name: 'Conversation' });

    await expect.element(panel.getByText('No comments yet.')).toBeVisible();
    expect(loadConversation).toHaveBeenCalledWith(KEY, []);
    await panel.getByRole('button', { name: 'Refresh Conversation' }).click();
    expect(loadConversation).toHaveBeenCalledTimes(2);
  });

  test('loads again when the socket says the comments have changed', async () => {
    await renderPanel();
    await expect.element(page.getByText('No comments yet.')).toBeVisible();

    additionsComments.versions[KEY] = 1;
    await vi.waitFor(() => expect(loadConversation).toHaveBeenCalledTimes(2));
  });

  test('shows the comments kept under the entry’s earlier keys, and follows them', async () => {
    vi.mocked(getConversationAliasKeys).mockReturnValue(['posts/old']);

    try {
      await renderPanel();
      await vi.waitFor(() => expect(loadConversation).toHaveBeenCalledWith(KEY, ['posts/old']));

      // A change under an earlier key
      additionsComments.versions['posts/old'] = 1;
      await vi.waitFor(() => expect(loadConversation).toHaveBeenCalledTimes(2));
      // Another count changing doesn’t load them again
      additionsComments.counts = { ...additionsComments.counts, 'posts/other': 1 };
      await sleep(100);
      expect(loadConversation).toHaveBeenCalledTimes(2);
    } finally {
      vi.mocked(getConversationAliasKeys).mockReturnValue([]);
      delete additionsComments.versions['posts/old'];
    }
  });

  test('shows the comments, oldest first, with their authors', async () => {
    const today = new Date();

    today.setHours(9, 30, 0, 0);

    await renderPanel({
      comments: [
        createItem({ id: 'c0', author: null, body: 'Old' }),
        createItem({ id: 'c1' }),
        createItem({
          id: 'c2',
          body: 'Fixed',
          author: { name: 'Me', login: 'me', isSelf: true },
          createdDate: new Date('2026-10-15T00:00:00Z'),
          updatedDate: new Date('2026-10-15T01:00:00Z'),
          canEdit: true,
          canDelete: true,
        }),
        createItem({ id: 'c3', body: 'Today', createdDate: today, updatedDate: today }),
      ],
    });

    const timeline = page.getByRole('log', { name: 'Comments' });
    const articles = timeline.getByRole('article');

    await expect.element(articles.nth(0)).toMatchTextContent(/Deleted user.*Old/);
    await expect.element(articles.nth(1)).toMatchTextContent(/Ada.*Hello there/);
    await expect.element(articles.nth(2)).toMatchTextContent(/You.*edited.*Fixed/);
    // The date is left out for today, and the year for this year
    await expect.element(articles.nth(1)).toMatchTextContent(/Oct 13,(?: 2026,)? \d+:\d+/);
    await expect.element(articles.nth(3)).toMatchTextContent(/Ada 9:30\sAM Today/);
    // With the author’s initials in place of an avatar, as for a commit in the History panel
    expect(
      [0, 1, 2].map((index) => articles.nth(index).element().querySelector('.avatar')?.textContent),
    ).toEqual(['', 'A', 'M']);
    // The Markdown is rendered
    expect(articles.nth(1).element().querySelector('strong')?.textContent).toBe('there');
    // Only the user’s own comment has options here
    expect(timeline.getByRole('button', { name: 'Comment Options' }).elements()).toHaveLength(1);
  });

  test('edits and deletes the user’s own comment', async () => {
    const own = createItem({ id: 'c2', body: 'Typo', canEdit: true, canDelete: true });

    await renderPanel({ comments: [own] });

    const article = page.getByRole('article');

    await article.getByRole('button', { name: 'Comment Options' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await article.getByRole('textbox', { name: 'Comment' }).fill('Fixed typo');
    await article.getByRole('button', { name: 'Save' }).click();
    await vi.waitFor(() => expect(updateComment).toHaveBeenCalledWith(KEY, 'c2', 'Fixed typo'));

    // A refused edit says why, and Cancel leaves the editor
    vi.mocked(updateComment).mockRejectedValueOnce(
      new Error('No', { cause: { message: 'Not yours' } }),
    );
    await article.getByRole('button', { name: 'Comment Options' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await article.getByRole('button', { name: 'Save' }).click();
    await expect.element(article.getByRole('alert')).toHaveTextContent('Not yours');
    await article.getByRole('button', { name: 'Cancel' }).click();
    expect(article.getByRole('alert').elements()).toHaveLength(0);

    await article.getByRole('button', { name: 'Comment Options' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete' });

    await expect.element(dialog).toMatchTextContent(/Delete this comment\?/);
    vi.mocked(removeComment).mockRejectedValueOnce(new Error('Network'));
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await vi.waitFor(() => expect(removeComment).toHaveBeenCalledWith(KEY, 'c2'));
    await expect.element(article.getByRole('alert')).toMatchTextContent(/unexpected error/);
  });

  test('offers deletion only, for an admin on someone else’s comment', async () => {
    await renderPanel({ comments: [createItem({ canDelete: true })] });

    await page.getByRole('button', { name: 'Comment Options' }).click();
    await expect.element(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    expect(page.getByRole('menuitem', { name: 'Edit' }).elements()).toHaveLength(0);
  });

  test('sends a comment with the button or Ctrl+Enter, and says why one failed', async () => {
    vi.mocked(sendComment).mockImplementation(async (key) => {
      conversations.drafts[key] = '';
    });

    await renderPanel();

    const textbox = page.getByRole('textbox', { name: 'Comment' });
    const send = page.getByRole('button', { name: 'Comment', exact: true });

    await expect.element(textbox).toHaveAccessibleDescription('Visible to CMS users only');
    await expect.element(send).toHaveAttribute('aria-disabled', 'true');
    await textbox.fill('Hello');
    expect(conversations.drafts[KEY]).toBe('Hello');
    await send.click();
    await vi.waitFor(() => expect(sendComment).toHaveBeenCalledWith(KEY));

    await textbox.fill('Again');
    await textbox.click();
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await vi.waitFor(() => expect(sendComment).toHaveBeenCalledTimes(2));

    // Enter alone is a new line; an empty comment isn’t sent
    await userEvent.keyboard('{Enter}');
    await textbox.fill('');
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
    expect(sendComment).toHaveBeenCalledTimes(2);

    vi.mocked(sendComment).mockRejectedValueOnce(
      new Error('Limit', { cause: { message: 'Slow down' } }),
    );
    await textbox.fill('Third');
    await send.click();
    await expect.element(page.getByRole('alert')).toHaveTextContent('Slow down');

    vi.mocked(sendComment).mockRejectedValueOnce(new Error('Network'));
    await send.click();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The comment couldn’t be sent.');
  });

  test('shows why the comments couldn’t be loaded', async () => {
    await renderPanel({ error: 'Not allowed' });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Not allowed');
  });

  test('waits for an entry that can have a conversation', async () => {
    vi.mocked(getDraftEntryKey).mockReturnValue(undefined);

    await renderWithDraft(ConversationPanel, {
      draft: createMockDraft({ draft: { isNew: true } }),
    });

    await expect.element(page.getByText('Loading…')).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Refresh Conversation' }))
      .toHaveAttribute('aria-disabled', 'true');
    expect(loadConversation).not.toHaveBeenCalled();
    expect(page.getByRole('textbox', { name: 'Comment' }).elements()).toHaveLength(0);
  });
});
