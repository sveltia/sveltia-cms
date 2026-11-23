import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { entryLocks, getLockKey } from '$lib/services/additions/locks.svelte';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import EntryViewers from './entry-viewers.svelte';

const KEY = getLockKey('posts', 'hello');

/**
 * Create a viewer of the entry.
 * @param {string} userId User ID.
 * @param {string} name Name.
 * @param {string} [connection] Connection ID. Default: one of the user’s own.
 * @returns {{ connection: string, user_id: string, name: string }} Viewer.
 */
const viewer = (userId, name, connection = `${userId}-tab`) => ({
  connection,
  user_id: userId,
  name,
});

/**
 * Render the avatars for an existing entry, which has a lock key.
 * @returns {Promise<any>} Render result.
 */
const renderViewers = () =>
  renderWithDraft(EntryViewers, {
    draft: createMockDraft({ draft: { isNew: false, fileName: 'hello' } }),
  });

describe('EntryViewers', () => {
  beforeEach(() => {
    Object.assign(entryLocks, { connection: 'c1', userId: 'u1', locks: {}, presence: {} });
  });

  afterEach(() => {
    Object.assign(entryLocks, { connection: '', userId: '', locks: {}, presence: {} });
  });

  test('shows nothing while nobody else has the entry open', async () => {
    // Only the user, in this tab and another
    entryLocks.presence[KEY] = [viewer('u1', 'Me', 'c1'), viewer('u1', 'Me', 'c9')];

    const { container } = await renderViewers();

    expect(page.getByRole('img').elements()).toHaveLength(0);
    expect(container.querySelector('.viewers')).toBeNull();
  });

  test('shows nothing for a new entry, which has no lock key', async () => {
    entryLocks.presence[KEY] = [viewer('u2', 'Ada Lovelace')];

    await renderWithDraft(EntryViewers, { draft: createMockDraft() });

    expect(page.getByRole('img').elements()).toHaveLength(0);
  });

  test('shows the initials of everyone else once each, and names them', async () => {
    entryLocks.presence[KEY] = [
      viewer('u1', 'Me', 'c1'),
      viewer('u2', 'Ada Lovelace'),
      viewer('u2', 'Ada Lovelace', 'u2-other-tab'),
      viewer('u3', 'bob'),
    ];

    const { container } = await renderViewers();
    const label = 'Also open by \u2068Ada Lovelace and bob\u2069';
    const avatars = page.getByRole('img', { name: label });

    await expect.element(avatars).toBeVisible();
    await expect.element(avatars).toHaveAttribute('title', label);
    expect([...container.querySelectorAll('.avatar')].map((avatar) => avatar.textContent)).toEqual([
      'AL',
      'B',
    ]);
    expect(container.querySelector('.more')).toBeNull();

    // Someone else opens it
    entryLocks.presence[KEY].push(viewer('u4', 'Carol'));
    await expect
      .element(
        page.getByRole('img', { name: 'Also open by \u2068Ada Lovelace, bob, and Carol\u2069' }),
      )
      .toBeVisible();
  });

  test('counts everyone beyond three', async () => {
    entryLocks.presence[KEY] = [
      viewer('u2', 'Ada'),
      viewer('u3', 'Bob'),
      viewer('u4', 'Carol'),
      viewer('u5', 'Dan'),
      viewer('u6', 'Eve'),
    ];

    const { container } = await renderViewers();

    await expect
      .element(
        page.getByRole('img', { name: 'Also open by \u2068Ada, Bob, Carol, Dan, and Eve\u2069' }),
      )
      .toBeVisible();
    expect([...container.querySelectorAll('.stacked')].map((avatar) => avatar.textContent)).toEqual(
      ['A', 'B', 'C', '+2'],
    );
    expect(container.querySelector('.more')?.textContent).toBe('+2');
  });
});
