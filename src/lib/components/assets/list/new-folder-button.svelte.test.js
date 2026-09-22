import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';

import NewFolderButton from './new-folder-button.svelte';

describe('NewFolderButton', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
  });

  test('is labelled, and calls the handler', async () => {
    const onclick = vi.fn();
    const { container } = await render(NewFolderButton, { onclick });
    const button = page.getByRole('button', { name: 'New Folder' });

    // A ghost button on a large screen, next to the other toolbar actions
    expect(container.querySelector('button')).toHaveClass('ghost');
    expect(container.querySelector('button')).toHaveClass('iconic');

    await button.click();
    expect(onclick).toHaveBeenCalledOnce();
  });

  test('gets a surface on a small screen, where it floats', async () => {
    env.isSmallScreen = true;

    const { container } = await render(NewFolderButton, { onclick: vi.fn(), disabled: true });

    expect(container.querySelector('button')).toHaveClass('secondary');
    expect(container.querySelector('button')).toHaveAttribute('aria-disabled', 'true');
  });
});
