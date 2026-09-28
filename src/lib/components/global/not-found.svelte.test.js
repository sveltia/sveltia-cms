import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import NotFound from './not-found.svelte';

describe('NotFound', () => {
  test('shows the message with a button going to the fallback page', async () => {
    window.location.hash = '#/collections/posts/missing';
    // The dead link was opened directly, so there’s no previous page in the app
    vi.spyOn(/** @type {Navigation} */ (window.navigation), 'entries').mockReturnValueOnce([]);

    await render(NotFound, { message: 'Entry not found.', backPath: '/collections/posts' });

    await expect.element(page.getByText('Entry not found.')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();

    await expect.poll(() => window.location.hash).toBe('#/collections/posts');
  });

  test('goes back to the previous page wherever it is', async () => {
    window.location.hash = '#/assets';
    await expect.poll(() => window.navigation?.currentEntry?.url).toMatch(/#\/assets$/);
    window.location.hash = '#/nowhere';
    await expect.poll(() => window.navigation?.currentEntry?.url).toMatch(/#\/nowhere$/);

    await render(NotFound, { message: 'Page not found.' });

    await page.getByRole('button', { name: 'Back' }).click();

    await expect.poll(() => window.location.hash).toBe('#/assets');
  });
});
