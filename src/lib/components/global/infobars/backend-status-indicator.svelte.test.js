import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { gitBackendServices } from '$lib/services/backends/git/services';
import { cmsConfig } from '$lib/services/config';

import BackendStatusIndicator from './backend-status-indicator.svelte';

/**
 * @import { BackendService } from '$lib/types/private';
 */

const { github } = /** @type {Record<string, BackendService>} */ (gitBackendServices);
const { checkStatus } = github;

describe('BackendStatusIndicator', () => {
  afterEach(() => {
    github.checkStatus = checkStatus;
  });

  test('shows nothing while the service is fine, or without a backend', async () => {
    backendName.current = undefined;
    expect((await render(BackendStatusIndicator, {})).container.children).toHaveLength(0);

    backendName.current = 'github';
    github.checkStatus = vi.fn().mockResolvedValue('none');
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });

    const { container } = await render(BackendStatusIndicator, {});

    await vi.waitFor(() => expect(github.checkStatus).toHaveBeenCalled());
    expect(container.children).toHaveLength(0);
  });

  test('warns about an incident with a link to the status dashboard', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    backendName.current = 'github';
    github.checkStatus = vi.fn().mockResolvedValue('major');
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });

    try {
      await render(BackendStatusIndicator, {});

      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          'error Error \u2068GitHub\u2069 is experiencing a major incident. You may want to wait until the situation has improved. Details',
        );
      await page.getByRole('button', { name: 'Details' }).click();
      expect(open).toHaveBeenCalledWith(github.statusDashboardURL, '_blank', 'noopener,noreferrer');
    } finally {
      open.mockRestore();
    }
  });

  test('warns about a minor incident', async () => {
    backendName.current = 'github';
    github.checkStatus = vi.fn().mockResolvedValue('minor');
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });

    await render(BackendStatusIndicator, {});

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'warning Warning \u2068GitHub\u2069 is experiencing a minor incident. Your workflow may be affected. Details',
      );
  });

  test('keeps checking periodically', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    backendName.current = 'github';
    github.checkStatus = vi.fn().mockResolvedValue('none');
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });

    try {
      await render(BackendStatusIndicator, {});
      await vi.waitFor(() => expect(github.checkStatus).toHaveBeenCalledOnce());
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(github.checkStatus).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
