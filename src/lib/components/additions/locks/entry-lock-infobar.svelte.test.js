import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { entryLocks, takeOverLock } from '$lib/services/additions/locks.svelte';
import { socketState } from '$lib/services/additions/socket.svelte';
import { user } from '$lib/services/user/account.svelte';

import EntryLockInfobar from './entry-lock-infobar.svelte';

// The state is real; taking over would send a message to Sveltia CMS Additions
vi.mock('$lib/services/additions/locks.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  takeOverLock: vi.fn(),
}));

const KEY = 'posts/hello@main';

const BOB_LOCK = {
  key: KEY,
  user_id: 'u2',
  name: 'Bob',
  since: '2026-10-13T09:30:00.000Z',
  connection: 'c2',
};

describe('EntryLockInfobar', () => {
  beforeEach(() => {
    user.account = /** @type {any} */ ({ backendName: 'github', role: 'editor' });
    socketState.status = 'connected';
    Object.assign(entryLocks, {
      connection: 'c1',
      userId: 'u1',
      locks: {},
      takenOver: {},
    });
  });

  afterEach(() => {
    socketState.status = 'disconnected';
    Object.assign(entryLocks, { connection: '', locks: {}, takenOver: {} });
  });

  test('says nothing while nobody else is editing the entry', async () => {
    await render(EntryLockInfobar, { lockKey: KEY });

    expect(page.getByRole('button', { name: 'Take Over' }).elements()).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/editing/);
  });

  test('says who is editing the entry, and offers to take it over', async () => {
    entryLocks.locks[KEY] = BOB_LOCK;

    await render(EntryLockInfobar, { lockKey: KEY });

    await expect
      .element(page.getByText(/Bob\u2069 has been editing this entry since/))
      .toBeVisible();

    const takeOver = page.getByRole('button', { name: 'Take Over' });

    await takeOver.click();
    expect(takeOverLock).toHaveBeenCalledWith(KEY);
    // Asked once, until the lock changes
    await expect.element(takeOver).toHaveAttribute('aria-disabled', 'true');
    entryLocks.locks[KEY] = { ...BOB_LOCK, name: 'Carol', user_id: 'u3' };
    await expect.element(takeOver).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('gives only the time someone started editing today, with the date for another day', async () => {
    const today = new Date();

    today.setHours(9, 30, 0, 0);
    entryLocks.locks[KEY] = { ...BOB_LOCK, since: today.toISOString() };

    const { rerender } = await render(EntryLockInfobar, { lockKey: KEY });

    await expect
      .element(page.getByText(/editing this entry since/))
      .toMatchTextContent(/since \u20689:30\sAM\u2069, so/);

    entryLocks.locks[KEY] = BOB_LOCK;
    await rerender({ lockKey: KEY });
    await expect
      .element(page.getByText(/editing this entry since/))
      .toMatchTextContent(/since \u2068Oct 13,(?: 2026,)? \d+:30\sAM\u2069, so/);
  });

  test('tells the user about their own other tab, and someone who took over', async () => {
    entryLocks.locks[KEY] = { ...BOB_LOCK, user_id: 'u1' };

    const { rerender } = await render(EntryLockInfobar, { lockKey: KEY });

    await expect.element(page.getByText(/editing this entry in another tab/)).toBeVisible();

    entryLocks.takenOver[KEY] = BOB_LOCK;
    await rerender({ lockKey: KEY });
    await expect.element(page.getByText(/Bob\u2069 took over this entry/)).toBeVisible();
  });

  test('warns when locks are unavailable, without anything to take over', async () => {
    socketState.status = 'unavailable';

    await render(EntryLockInfobar, { lockKey: KEY });

    await expect.element(page.getByText(/Entry locks are unavailable/)).toBeVisible();
    expect(page.getByRole('button', { name: 'Take Over' }).elements()).toHaveLength(0);
  });

  test('doesn’t offer viewers to take over', async () => {
    user.account = /** @type {any} */ ({ backendName: 'github', role: 'viewer' });
    entryLocks.locks[KEY] = BOB_LOCK;

    await render(EntryLockInfobar, { lockKey: KEY });

    await expect.element(page.getByText(/has been editing this entry/)).toBeVisible();
    expect(page.getByRole('button', { name: 'Take Over' }).elements()).toHaveLength(0);
  });
});
