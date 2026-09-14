import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { isUpdateAvailable } from '$lib/services/app/update';

import UpdateNotification from './update-notification.svelte';

vi.mock('$lib/services/app/update', () => ({
  isUpdateAvailable: vi.fn(),
  UPDATE_CACHE_TIMEOUT: 20,
  UPDATE_CHECK_INTERVAL: 50,
}));

describe('UpdateNotification', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('shows nothing during development, where the app is served from source', async () => {
    const { container } = await render(UpdateNotification, {});

    // The check only runs in a production build, which Vitest is not
    expect(import.meta.env.DEV).toBe(true);
    expect(container.children).toHaveLength(0);
    expect(isUpdateAvailable).not.toHaveBeenCalled();
  });

  test('checks for updates periodically in production, and offers to reload', async () => {
    vi.stubEnv('DEV', false);
    vi.mocked(isUpdateAvailable).mockResolvedValue(false);

    const { container, unmount } = await render(UpdateNotification, {});

    expect(isUpdateAvailable).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(isUpdateAvailable).toHaveBeenCalledTimes(2));
    expect(container.children).toHaveLength(0);

    // The notification is shown a while after an update is found
    vi.mocked(isUpdateAvailable).mockResolvedValue(true);
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('info The latest version of Sveltia CMS is available. Update Now');

    // The checks stop once the component is gone
    unmount();

    const { calls } = vi.mocked(isUpdateAvailable).mock;

    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });
    expect(vi.mocked(isUpdateAvailable).mock.calls).toBe(calls);
  });
});
