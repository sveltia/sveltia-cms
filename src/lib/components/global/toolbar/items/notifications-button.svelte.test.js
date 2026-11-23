import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import NotificationsButton from './notifications-button.svelte';

describe('NotificationsButton', () => {
  test('is hidden until notifications are implemented', async () => {
    const { container } = await render(NotificationsButton, {});
    const button = container.querySelector('button');

    expect(button).toHaveAttribute('aria-label', 'Show Notifications');
    expect(button).toHaveAttribute('hidden');
    // Nothing happens yet
    button?.click();
  });
});
