import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { repository } from '$lib/services/backends/git/github/repository';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

import OpenAuthoringIndicator from './open-authoring-indicator.svelte';

describe('OpenAuthoringIndicator', () => {
  test('shows nothing unless contributing via a fork', async () => {
    forkedRepository.current = undefined;

    expect((await render(OpenAuthoringIndicator, {})).container.children).toHaveLength(0);
  });

  test('names the fork and links to it', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    backendName.current = 'github';
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    try {
      const { container } = await render(OpenAuthoringIndicator, {});

      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          'info Your changes are saved to your fork of this repository at “\u2068me/site\u2069” and reviewed before they go live.',
        );

      // Dismissing hides the infobar
      await page.getByRole('button', { name: 'Dismiss' }).click();
      await expect.poll(() => container.querySelector('.infobar')).toBeNull();
    } finally {
      open.mockRestore();
      forkedRepository.current = undefined;
    }
  });

  test('has no link to the fork without a backend', async () => {
    backendName.current = undefined;
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    try {
      await render(OpenAuthoringIndicator, {});

      await expect.element(page.getByRole('alert')).toBeVisible();
      expect(page.getByRole('button', { name: 'View Fork' }).elements()).toHaveLength(0);
    } finally {
      forkedRepository.current = undefined;
    }
  });

  test('opens the fork once the repository is known', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    backendName.current = 'github';
    Object.assign(repository, { repoURL: 'https://github.com/acme/site' });
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    try {
      const { container } = await render(OpenAuthoringIndicator, {});

      await page.getByRole('button', { name: 'View Fork' }).click();
      expect(open).toHaveBeenCalledWith(
        'https://github.com/me/site',
        '_blank',
        'noopener,noreferrer',
      );
      await expect.poll(() => container.querySelector('.infobar')).toBeNull();
    } finally {
      open.mockRestore();
      Object.assign(repository, { repoURL: '' });
      forkedRepository.current = undefined;
    }
  });
});
