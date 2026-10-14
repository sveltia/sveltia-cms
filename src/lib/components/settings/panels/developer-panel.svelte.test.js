import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { checkLocalGitStatus } from '$lib/services/backends/fs/local';
import { cmsConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs.svelte';

import DeveloperPanel from './developer-panel.svelte';

vi.mock('$lib/services/backends/fs/local', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  checkLocalGitStatus: vi.fn(),
}));

describe('DeveloperPanel', () => {
  beforeEach(() => {
    prefs.devModeEnabled = false;
    // Turned on, unless a test says otherwise
    prefs.localGitCommits = true;
    prefs.deployHookURL = '';
    prefs.deployHookAuthHeader = '';
    backendName.current = 'github';
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });
    // A signed-in user always gets a status
    vi.mocked(checkLocalGitStatus).mockResolvedValue({
      ready: true,
      branch: 'refs/heads/main',
      author: { name: 'Jane Doe', email: 'jane@example.com' },
    });
  });

  test('toggles the developer mode preference', async () => {
    await render(DeveloperPanel, {});

    const devMode = page.getByRole('switch', { name: 'Enable Developer Mode' });

    await expect.element(devMode).not.toBeChecked();
    await devMode.click();
    await expect.poll(() => prefs.devModeEnabled).toBe(true);
    prefs.devModeEnabled = false;
  });

  test('offers the Git commits setting only with the local backend', async () => {
    await render(DeveloperPanel, {});
    expect(page.getByRole('switch', { name: 'Commit Changes to Git' }).elements()).toHaveLength(0);

    backendName.current = 'local';
    await expect.element(page.getByRole('switch', { name: 'Commit Changes to Git' })).toBeVisible();
  });

  test('checks whether the changes can be committed while Git commits are on', async () => {
    let resolveStatus = /** @type {(status: any) => void} */ (vi.fn());

    vi.mocked(checkLocalGitStatus).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
    );
    backendName.current = 'local';
    await render(DeveloperPanel, {});

    const toggle = page.getByRole('switch', { name: 'Commit Changes to Git' });

    await expect.element(toggle).toBeChecked();
    await expect.element(page.getByText('Checking the repository…')).toBeVisible();

    resolveStatus({
      ready: true,
      branch: 'refs/heads/main',
      author: { name: 'Jane Doe', email: 'jane@example.com' },
    });

    // A success is a status, while a warning below is an alert
    await expect
      .element(page.getByRole('status'))
      .toMatchTextContent(
        'Changes will be committed to the \u2068main\u2069 branch as \u2068Jane Doe\u2069 (\u2068jane@example.com\u2069).',
      );

    // Nothing is checked while the setting is off, and the repository is checked again when it’s
    // turned back on
    vi.mocked(checkLocalGitStatus).mockResolvedValueOnce({
      ready: false,
      reason: 'staged_changes',
    });
    await toggle.click();
    await expect.poll(() => prefs.localGitCommits).toBe(false);
    await expect.element(toggle).not.toBeChecked();
    await expect.element(page.getByRole('status')).not.toBeInTheDocument();
    expect(checkLocalGitStatus).toHaveBeenCalledTimes(1);
    await toggle.click();
    await expect.poll(() => prefs.localGitCommits).toBe(true);

    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent(
        'Changes can’t be committed right now. \u2068You have other changes staged for commit. Commit or unstage them first.\u2069',
      );
    expect(checkLocalGitStatus).toHaveBeenCalledTimes(2);
  });

  test('treats an unset Git commits preference as off', async () => {
    delete prefs.localGitCommits;
    backendName.current = 'local';
    await render(DeveloperPanel, {});

    await expect
      .element(page.getByRole('switch', { name: 'Commit Changes to Git' }))
      .not.toBeChecked();
    expect(page.getByText('Checking the repository…').elements()).toHaveLength(0);
    expect(checkLocalGitStatus).not.toHaveBeenCalled();
  });

  test('offers the deploy hook settings only when skipping CI is configured', async () => {
    const onChange = vi.fn();

    await render(DeveloperPanel, { onChange });
    expect(page.getByRole('textbox').elements()).toHaveLength(0);

    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github', skip_ci: true } });

    const url = page.getByRole('textbox', { name: 'Hook URL' });

    await expect.element(url).toBeVisible();
    await url.fill('https://example.com/hook');
    await url.element().blur();

    await expect.poll(() => prefs.deployHookURL).toBe('https://example.com/hook');
    expect(onChange).toHaveBeenCalledWith({ message: 'Hook URL saved.' });

    await url.fill('');
    await url.element().blur();
    await expect.poll(() => prefs.deployHookURL).toBe('');
    expect(onChange).toHaveBeenLastCalledWith({ message: 'Hook URL removed.' });

    const auth = page.getByRole('textbox', { name: /^Authorization header/ });

    await auth.fill('Bearer abc');
    await auth.element().blur();
    await expect.poll(() => prefs.deployHookAuthHeader).toBe('Bearer abc');
    expect(onChange).toHaveBeenLastCalledWith({ message: 'Authorization header saved.' });

    await auth.fill('');
    await auth.element().blur();
    await expect.poll(() => prefs.deployHookAuthHeader).toBe('');
    expect(onChange).toHaveBeenLastCalledWith({ message: 'Authorization header removed.' });
  });

  test('shows the saved deploy hook settings', async () => {
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github', skip_ci: true } });
    prefs.deployHookURL = 'https://example.com/hook';
    prefs.deployHookAuthHeader = 'Bearer abc';

    await render(DeveloperPanel, {});

    await expect
      .element(page.getByRole('textbox', { name: 'Hook URL' }))
      .toHaveValue('https://example.com/hook');
    await expect
      .element(page.getByRole('textbox', { name: /^Authorization header/ }))
      .toHaveValue('Bearer abc');
  });
});
