import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { repository } from '$lib/services/backends/git/github/repository';
import { prefs } from '$lib/services/user/prefs.svelte';

import ViewInRepositoryItem from './view-in-repository-item.svelte';

describe('ViewInRepositoryItem', () => {
  afterEach(() => {
    prefs.devModeEnabled = false;
    backendName.current = undefined;
    Object.assign(repository, { label: '' });
  });

  test('is only offered in developer mode', async () => {
    await render(ViewInRepositoryItem, { disabled: false, onclick: vi.fn() });

    expect(page.getByRole('menuitem').elements()).toHaveLength(0);
  });

  test('is named after the Git hosting service, and opens the file', async () => {
    const onclick = vi.fn();

    prefs.devModeEnabled = true;
    backendName.current = 'github';
    Object.assign(repository, { label: 'GitHub' });

    await render(ViewInRepositoryItem, { disabled: false, onclick });
    await page.getByRole('menuitem', { name: 'View on \u2068GitHub\u2069' }).click();
    expect(onclick).toHaveBeenCalledOnce();
  });

  test('falls back to a generic name, and can be disabled', async () => {
    prefs.devModeEnabled = true;

    await render(ViewInRepositoryItem, { disabled: true, onclick: vi.fn() });
    await expect
      .element(page.getByRole('menuitem', { name: 'View in Repository' }))
      .toHaveAttribute('aria-disabled', 'true');
  });
});
