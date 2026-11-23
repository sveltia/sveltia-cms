import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  loadGitHubStatus,
  replacePrivateKey,
  saveCommitAuthor,
} from '$lib/services/additions/site-settings';
import { additionsUsers, loadSiteSettings } from '$lib/services/additions/users.svelte';
import { openNewTab } from '$lib/services/utils/window';

import GitHubPanel from './github-panel.svelte';

// The panel talks to Sveltia CMS Additions; the state is real, the requests aren’t
vi.mock('$lib/services/additions/site-settings', async (importOriginal) => ({
  ...(await importOriginal()),
  loadGitHubStatus: vi.fn(),
  replacePrivateKey: vi.fn(),
  saveCommitAuthor: vi.fn(),
}));
vi.mock('$lib/services/additions/users.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  loadSiteSettings: vi.fn(),
}));
vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));

const APP = {
  id: 101,
  slug: 'sveltia-cms-site',
  owner: 'acme',
  html_url: 'https://github.com/apps/sveltia-cms-site',
  settings_url: 'https://github.com/organizations/acme/settings/apps/sveltia-cms-site',
};

/**
 * Make the next status check return the given status.
 * @param {Record<string, any>} [overrides] Values to change.
 */
const respond = (overrides = {}) => {
  vi.mocked(loadGitHubStatus).mockImplementation(async () => {
    additionsUsers.github = /** @type {any} */ ({
      status: 'ok',
      app: APP,
      installation: { owner: 'acme', name: 'site' },
      default_branch: { name: 'main', protection: 'protected' },
      ...overrides,
    });
  });
};

describe('GitHubPanel', () => {
  beforeEach(() => {
    additionsUsers.github = undefined;
    additionsUsers.commitAuthor = 'user';
    vi.mocked(loadSiteSettings).mockResolvedValue();
    respond();
  });

  test('shows the saved commit author, loaded with the other settings', async () => {
    // Another section hasn’t loaded them yet
    vi.mocked(loadSiteSettings).mockImplementation(async () => {
      additionsUsers.commitAuthor = 'bot';
    });

    await render(GitHubPanel, { title: 'GitHub' });

    await expect
      .element(page.getByRole('radio', { name: 'The GitHub App, with the person as co-author' }))
      .toBeChecked();
    expect(loadSiteSettings).toHaveBeenCalledOnce();
  });

  test('says it’s loading while GitHub is asked about the app', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(loadGitHubStatus).mockReturnValue(/** @type {Promise<void>} */ (promise));

    await render(GitHubPanel, { title: 'GitHub' });
    await expect.element(page.getByRole('status')).toHaveTextContent('Loading…');
    additionsUsers.github = /** @type {any} */ ({
      status: 'ok',
      app: APP,
      installation: { owner: 'acme', name: 'site' },
      default_branch: { name: 'main', protection: 'protected' },
    });
    resolve(undefined);
    await expect.element(page.getByText('Loading…')).not.toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: 'acme/site' })).toBeVisible();
  });

  test('doesn’t link to app pages that aren’t on GitHub', async () => {
    respond({
      // eslint-disable-next-line no-script-url
      app: { ...APP, html_url: 'javascript:alert(1)', settings_url: 'https://evil.example/' },
    });
    await render(GitHubPanel, { title: 'GitHub' });

    await expect.element(page.getByText('sveltia-cms-site')).toBeVisible();
    expect(page.getByRole('link', { name: 'sveltia-cms-site' }).elements()).toHaveLength(0);
    await page.getByRole('button', { name: 'Replace Private Key' }).click();
    await expect.element(page.getByRole('button', { name: 'Open App Settings' })).toBeDisabled();
  });

  test('shows the app, the repository and a protected default branch', async () => {
    await render(GitHubPanel, { title: 'GitHub' });

    await expect
      .element(page.getByRole('link', { name: 'sveltia-cms-site' }))
      .toHaveAttribute('href', APP.html_url);
    await expect
      .element(page.getByRole('link', { name: 'acme/site' }))
      .toHaveAttribute('href', 'https://github.com/acme/site');
    await expect.element(page.getByText('The app works.')).toBeVisible();
    await expect.element(page.getByText(/Rulesets protect the .+main.+ branch from/)).toBeVisible();
    expect(page.getByRole('button', { name: 'Open Repository Rules' }).elements()).toHaveLength(0);
    // The app works, so the private key section only says what the key is for, and the steps to
    // replace it wait for a click
    await expect.element(page.getByRole('heading', { name: 'Private Key' })).toBeVisible();
    await expect.element(page.getByText(/uses the app’s private key/)).toBeVisible();
    expect(page.getByRole('button', { name: 'Upload Private Key' }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Replace Private Key' }).click();
    await expect.element(page.getByRole('button', { name: 'Upload Private Key' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Replace Private Key' }).elements()).toHaveLength(0);
    await page.getByRole('button', { name: 'Open App Settings' }).click();
    expect(openNewTab).toHaveBeenCalledWith(APP.settings_url);

    await page.getByRole('button', { name: 'Check Again' }).click();
    await vi.waitFor(() => expect(loadGitHubStatus).toHaveBeenCalledTimes(2));
  });

  test('warns when the app can change the default branch’s history', async () => {
    respond({ default_branch: { name: 'main', protection: 'unprotected' } });

    await render(GitHubPanel, { title: 'GitHub' });

    await expect.element(page.getByText(/No ruleset protects the .+main.+ branch/)).toBeVisible();
    await page.getByRole('button', { name: 'Open Repository Rules' }).click();
    expect(openNewTab).toHaveBeenCalledWith('https://github.com/acme/site/settings/rules');
  });

  test('explains a broken connection', async () => {
    respond({ status: 'key_missing', installation: null, default_branch: null });

    await render(GitHubPanel, { title: 'GitHub' });

    await expect.element(page.getByText(/private key was lost/)).toBeVisible();
    await expect.element(page.getByText('Not installed')).toBeVisible();
  });

  test('says when no app is set up', async () => {
    respond({ status: 'not_registered', app: null, installation: null, default_branch: null });

    await render(GitHubPanel, { title: 'GitHub' });

    await expect.element(page.getByText(/No GitHub App is set up yet/)).toBeVisible();
    expect(page.getByRole('button', { name: 'Upload Private Key' }).elements()).toHaveLength(0);
  });

  test.each(['key_missing', 'key_rejected'])(
    'asks for a new private key straight away when it’s %s',
    async (status) => {
      respond({ status });
      await render(GitHubPanel, { title: 'GitHub' });

      await expect.element(page.getByRole('heading', { name: 'Private Key' })).toBeVisible();
      await expect.element(page.getByRole('button', { name: 'Upload Private Key' })).toBeVisible();
      expect(page.getByRole('button', { name: 'Replace Private Key' }).elements()).toHaveLength(0);
    },
  );

  test('lists the commit author choices one under another', async () => {
    await render(GitHubPanel, { title: 'GitHub' });

    await expect
      .element(page.getByRole('radiogroup'))
      .toHaveAttribute('aria-orientation', 'vertical');
  });

  test('says a lost key has been replaced, though the steps are no longer needed', async () => {
    respond({ status: 'key_missing' });
    vi.mocked(replacePrivateKey).mockImplementation(async () => {
      additionsUsers.github = /** @type {any} */ ({
        status: 'ok',
        app: APP,
        installation: { owner: 'acme', name: 'site' },
        default_branch: { name: 'main', protection: 'protected' },
      });
    });

    await render(GitHubPanel, { title: 'GitHub' });

    const input = /** @type {HTMLInputElement} */ (document.querySelector('input[type="file"]'));

    await page.getByRole('button', { name: 'Upload Private Key' }).click();
    await page.elementLocator(input).upload(new File(['key'], 'app.pem'));

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('The private key has been replaced.');
    await expect.element(page.getByText('The app works.')).toBeVisible();
  });

  test('uploads a new private key', async () => {
    await render(GitHubPanel, { title: 'GitHub' });

    const input = /** @type {HTMLInputElement} */ (document.querySelector('input[type="file"]'));
    const file = new File(['-----BEGIN RSA PRIVATE KEY-----'], 'app.pem');

    expect(input.accept).toBe('.pem');
    await page.getByRole('button', { name: 'Replace Private Key' }).click();
    await page.getByRole('button', { name: 'Upload Private Key' }).click();
    await page.elementLocator(input).upload(file);

    await vi.waitFor(() => expect(replacePrivateKey).toHaveBeenCalledWith(file));
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('The private key has been replaced.');
  });

  test('chooses who appears as the author of the commits', async () => {
    vi.mocked(saveCommitAuthor).mockImplementation(async (mode) => {
      additionsUsers.commitAuthor = mode;
    });

    await render(GitHubPanel, { title: 'GitHub' });

    const group = page.getByRole('radiogroup', { name: 'Commit Author' });

    await expect
      .element(group.getByRole('radio', { name: 'The person who made the change' }))
      .toBeChecked();
    await group
      .getByRole('radio', { name: 'The GitHub App, with the person as co-author' })
      .click();

    await vi.waitFor(() => expect(saveCommitAuthor).toHaveBeenCalledWith('bot'));
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('The commit author has been saved.');
    await expect
      .element(group.getByRole('radio', { name: 'The GitHub App, with the person as co-author' }))
      .toBeChecked();
  });

  test('keeps the saved commit author when the change is refused', async () => {
    vi.mocked(saveCommitAuthor).mockRejectedValue(
      new Error('Refused', { cause: { message: 'Refused.' } }),
    );

    await render(GitHubPanel, { title: 'GitHub' });

    const group = page.getByRole('radiogroup', { name: 'Commit Author' });

    await group
      .getByRole('radio', { name: 'The GitHub App, with the person as co-author' })
      .click();

    await expect.element(page.getByRole('alert')).toHaveTextContent('Refused.');
    await expect
      .element(group.getByRole('radio', { name: 'The person who made the change' }))
      .toBeChecked();
  });

  test('shows why a request failed', async () => {
    vi.mocked(loadGitHubStatus).mockRejectedValue(
      new Error('Locked', { cause: { message: 'Locked.' } }),
    );

    await render(GitHubPanel, { title: 'GitHub' });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Locked.');
  });

  test('shows a generic message for an error without one', async () => {
    vi.mocked(loadGitHubStatus).mockRejectedValue(new Error('Network'));

    await render(GitHubPanel, { title: 'GitHub' });

    await expect.element(page.getByRole('alert')).toMatchTextContent(/unexpected error/);
  });
});
