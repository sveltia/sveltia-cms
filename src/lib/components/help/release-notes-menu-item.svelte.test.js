import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { version } from '$lib/services/app';
import { prefs } from '$lib/services/user/prefs.svelte';

import ReleaseNotesMenuItem from './release-notes-menu-item.svelte';

describe('ReleaseNotesMenuItem', () => {
  test('opens the release notes', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    prefs.devModeEnabled = false;

    try {
      const { container } = await render(ReleaseNotesMenuItem, {});

      expect(container.querySelector('.version')).toBeNull();
      await page.getByRole('menuitem', { name: 'Release Notes' }).click();
      expect(open).toHaveBeenCalledWith(
        'https://github.com/sveltia/sveltia-cms/releases',
        '_blank',
        'noopener,noreferrer',
      );
    } finally {
      open.mockRestore();
    }
  });

  test('shows the version in developer mode', async () => {
    prefs.devModeEnabled = true;

    try {
      const { container } = await render(ReleaseNotesMenuItem, {});

      expect(container.querySelector('.version')).toHaveTextContent(`v${version}`);
    } finally {
      prefs.devModeEnabled = false;
    }
  });
});
