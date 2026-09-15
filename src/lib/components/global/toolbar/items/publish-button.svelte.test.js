import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { canTriggerDeployment, triggerDeployment } from '$lib/services/deployments/publish';
import { env } from '$lib/services/user/env.svelte';
import { waitForToastsToHide } from '$lib/test/toast';

import PublishButton from './publish-button.svelte';

// Whether a deployment can be triggered depends on the CI/CD provider’s status, which is out of
// scope here, so the whole module is replaced with plain state
vi.mock('$lib/services/deployments/publish', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return {
    setLastCommitPublishHint: vi.fn(),
    isLastCommitPublished: createRawState(false),
    canTriggerDeployment: createRawState(true),
    triggerDeployment: vi.fn(),
  };
});

describe('PublishButton', () => {
  beforeEach(() => {
    backendName.current = 'github';
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github', skip_ci: true } });
    /** @type {any} */ (canTriggerDeployment).current = true;
  });

  test('shows nothing unless skipping CI is configured', async () => {
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });

    expect((await render(PublishButton, {})).container.children).toHaveLength(0);
  });

  test('publishes the changes and reports the progress', async () => {
    vi.mocked(triggerDeployment).mockResolvedValue(undefined);

    await render(PublishButton, {});
    await page.getByRole('button', { name: 'Publish Changes' }).click();

    expect(triggerDeployment).toHaveBeenCalledOnce();
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('info Information Publishing Changes…');
  });

  test('reports a failure', async () => {
    vi.mocked(triggerDeployment).mockRejectedValue(new Error('Boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await render(PublishButton, {});
    await page.getByRole('button', { name: 'Publish Changes' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Error Couldn’t publish changes. Please try again.');
    await waitForToastsToHide();
  });

  test('is smaller on a small screen', async () => {
    env.isSmallScreen = true;

    try {
      await render(PublishButton, {});
      await expect
        .element(page.getByRole('button', { name: 'Publish Changes' }))
        .toHaveClass('small');
    } finally {
      env.isSmallScreen = false;
    }
  });

  test('is disabled when nothing can be deployed', async () => {
    /** @type {any} */ (canTriggerDeployment).current = false;

    await render(PublishButton, {});
    await expect
      .element(page.getByRole('button', { name: 'Publish Changes' }))
      .toHaveAttribute('aria-disabled', 'true');
  });
});
