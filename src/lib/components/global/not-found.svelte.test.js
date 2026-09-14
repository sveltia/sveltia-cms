import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import NotFound from './not-found.svelte';

describe('NotFound', () => {
  test('shows the message with a button going back', async () => {
    window.location.hash = '#/collections/posts/missing';

    await render(NotFound, { message: 'Entry not found.', backPath: '/collections/posts' });

    await expect.element(page.getByText('Entry not found.')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();

    await expect.poll(() => window.location.hash).toBe('#/collections/posts');
  });
});
