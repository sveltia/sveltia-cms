import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { isLiveReloadedPage } from '$lib/services/app/dev-server';
import { backendName } from '$lib/services/backends';

import LiveReloadInfobar from './live-reload-infobar.svelte';

vi.mock('$lib/services/app/dev-server', async (importOriginal) => ({
  ...(await importOriginal()),
  isLiveReloadedPage: vi.fn(),
}));

describe('LiveReloadInfobar', () => {
  afterEach(() => {
    backendName.current = undefined;
  });

  test('warns about a live-reloaded page while working with a local repository', async () => {
    vi.mocked(isLiveReloadedPage).mockReturnValue(true);
    backendName.current = 'local';

    const { container } = await render(LiveReloadInfobar, {});
    const alert = page.getByRole('alert');

    await expect.element(alert).toMatchTextContent(/Your development server reloads this page/);
    await expect
      .element(alert.getByRole('link', { name: 'Learn more' }))
      .toHaveAttribute('href', 'https://sveltiacms.app/en/docs/workflows/local#troubleshooting');

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect.poll(() => container.querySelector('.infobar')).toBeNull();
  });

  test('shows nothing with a remote repository', async () => {
    vi.mocked(isLiveReloadedPage).mockReturnValue(true);
    backendName.current = 'github';

    const { container } = await render(LiveReloadInfobar, {});

    expect(container.querySelector('.infobar')).toBeNull();
  });

  test('shows nothing on a static page', async () => {
    vi.mocked(isLiveReloadedPage).mockReturnValue(false);
    backendName.current = 'local';

    const { container } = await render(LiveReloadInfobar, {});

    expect(container.querySelector('.infobar')).toBeNull();
  });
});
