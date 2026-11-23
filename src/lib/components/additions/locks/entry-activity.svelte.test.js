import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { entryLocks, getLockKey } from '$lib/services/additions/locks.svelte';

import EntryActivity from './entry-activity.svelte';

const KEY = getLockKey('posts', 'hello');
const PROPS = { collectionName: 'posts', subPath: 'hello' };

const BOB_LOCK = {
  key: KEY,
  user_id: 'u2',
  name: 'Bob',
  since: '2026-10-13T09:30:00.000Z',
  connection: 'c2',
};

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

describe('EntryActivity', () => {
  beforeEach(() => {
    Object.assign(entryLocks, { connection: 'c1', userId: 'u1', locks: {}, presence: {} });
  });

  afterEach(() => {
    Object.assign(entryLocks, { connection: '', userId: '', locks: {}, presence: {} });
  });

  test('shows nothing while nobody else is editing or viewing the entry', async () => {
    // The user’s own lock and presence aren’t shown
    entryLocks.locks[KEY] = { ...BOB_LOCK, user_id: 'u1', name: 'Me', connection: 'c1' };
    entryLocks.presence[KEY] = [viewer('u1', 'Me', 'c1')];

    await render(EntryActivity, PROPS);

    expect(page.getByRole('img').elements()).toHaveLength(0);
  });

  test('shows that someone else is editing the entry', async () => {
    entryLocks.locks[KEY] = BOB_LOCK;
    entryLocks.presence[KEY] = [viewer('u2', 'Bob', 'c2')];

    const { container } = await render(EntryActivity, PROPS);
    const label = 'Being edited by \u2068Bob\u2069';

    await expect.element(page.getByRole('img', { name: label })).toHaveAttribute('title', label);
    // The editor isn’t counted as a reader too
    expect(page.getByRole('img', { name: /Open by/ }).elements()).toHaveLength(0);
    expect(container.querySelector('.count')).toBeNull();
  });

  test('counts and names the others who have the entry open', async () => {
    entryLocks.presence[KEY] = [
      viewer('u1', 'Me', 'c1'),
      viewer('u3', 'Ada'),
      viewer('u3', 'Ada', 'u3-other-tab'),
      viewer('u4', 'Carol'),
    ];

    const { container } = await render(EntryActivity, PROPS);
    const label = 'Open by \u2068Ada and Carol\u2069';

    await expect.element(page.getByRole('img', { name: label })).toHaveAttribute('title', label);
    expect(container.querySelector('.count')?.textContent).toBe('2');
    expect(page.getByRole('img', { name: /Being edited by/ }).elements()).toHaveLength(0);
  });

  test('shows the editor and the readers, leaving the editor out of the readers', async () => {
    entryLocks.locks[KEY] = BOB_LOCK;
    entryLocks.presence[KEY] = [
      viewer('u2', 'Bob', 'c2'),
      // Bob also has it open, read-only, in another tab
      viewer('u2', 'Bob', 'c3'),
      viewer('u3', 'Ada'),
      viewer('u4', 'Carol'),
      viewer('u5', 'Dan'),
    ];

    const { container } = await render(EntryActivity, PROPS);

    await expect
      .element(page.getByRole('img', { name: 'Being edited by \u2068Bob\u2069' }))
      .toBeVisible();
    await expect
      .element(page.getByRole('img', { name: 'Open by \u2068Ada, Carol, and Dan\u2069' }))
      .toBeVisible();
    expect(container.querySelector('.count')?.textContent).toBe('3');

    // Bob closes the entry; Ada is left
    delete entryLocks.locks[KEY];
    entryLocks.presence[KEY] = [viewer('u3', 'Ada')];
    await expect.element(page.getByRole('img', { name: 'Open by \u2068Ada\u2069' })).toBeVisible();
    expect(page.getByRole('img', { name: /Being edited by/ }).elements()).toHaveLength(0);
  });
});
