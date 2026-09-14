import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { announcedPageStatus } from '$lib/services/app/navigation';

import NotFoundPage from './not-found-page.svelte';

describe('NotFoundPage', () => {
  test('shows the not found message and announces it', async () => {
    announcedPageStatus.current = '';

    await render(NotFoundPage, {});

    await expect.element(page.getByText('Page not found.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Back' })).toBeVisible();
    expect(announcedPageStatus.current).toBe('Page not found.');
  });
});
