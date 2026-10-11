import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import UnavailableBadge from './unavailable-badge.svelte';

describe('UnavailableBadge', () => {
  test('marks the file as unavailable', async () => {
    const { container } = await render(UnavailableBadge);
    const badge = container.querySelector('.badge');

    await expect.element(page.getByText('Unavailable')).toBeVisible();
    // A presentational pill: the text is read, but the element has no role of its own
    expect(badge).toHaveAttribute('role', 'none');
    expect(badge).toHaveTextContent('Unavailable');
  });
});
