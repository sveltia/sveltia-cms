import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  additionsSetup,
  closeSetup,
  connectGitHub,
  rekeyDataKey,
  rewrapDataKey,
  saveAdmin,
  unlockSetup,
} from '$lib/services/additions/setup.svelte';
import { listTenants } from '$lib/services/additions/tenants';
import { cmsConfig } from '$lib/services/config';

import SetupWizard from './setup-wizard.svelte';

// The wizard talks to Sveltia CMS Additions; the state is real, the requests are not
vi.mock('$lib/services/additions/setup.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  unlockSetup: vi.fn(),
  saveAdmin: vi.fn(),
  connectGitHub: vi.fn(),
  rewrapDataKey: vi.fn(),
  rekeyDataKey: vi.fn(),
  closeSetup: vi.fn(),
}));

// The Other Sites view is tested on its own; by default, the service doesn’t offer it
vi.mock('$lib/services/additions/tenants', async (importOriginal) => ({
  ...(await importOriginal()),
  listTenants: vi.fn(async () => null),
}));

/**
 * Setup status the wizard shows once unlocked.
 * @param {Record<string, any>} [overrides] Values to change.
 * @returns {any} Status.
 */
const createStatus = (overrides = {}) => ({
  site_id: 'site',
  data_key: 'ok',
  admins: 0,
  allowed_domains: [],
  github_app: null,
  installation: null,
  ...overrides,
});

describe('SetupWizard', () => {
  beforeEach(() => {
    cmsConfig.current = /** @type {any} */ ({
      backend: {
        name: 'github',
        repo: 'acme/site',
        auth_type: 'additions',
        base_url: 'https://additions.example.com',
      },
    });
    additionsSetup.status = undefined;
    additionsSetup.secret = '';
    vi.mocked(unlockSetup).mockReset();
  });

  test('asks for the admin secret first', async () => {
    await render(SetupWizard, {});

    const continueButton = page.getByRole('button', { name: 'Continue' });

    await expect
      .element(page.getByRole('region', { name: 'Set Up Sveltia CMS Additions' }))
      .toBeVisible();
    await expect.element(continueButton).toHaveAttribute('aria-disabled', 'true');
    await page.getByLabelText('Admin secret').fill('the secret');
    await continueButton.click();

    await vi.waitFor(() => expect(unlockSetup).toHaveBeenCalledWith('the secret'));
    // The secret isn’t left in the field
    await expect.element(page.getByLabelText('Admin secret')).toHaveValue('');
  });

  test('shows why the secret was refused', async () => {
    vi.mocked(unlockSetup).mockRejectedValue(
      new Error('Wrong', { cause: { message: 'The admin secret is wrong.' } }),
    );

    await render(SetupWizard, {});
    await page.getByLabelText('Admin secret').fill('wrong');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect.element(page.getByRole('alert')).toHaveTextContent('The admin secret is wrong.');
  });

  test('shows a generic message for an error without one', async () => {
    vi.mocked(unlockSetup).mockRejectedValue(new Error('Network'));

    await render(SetupWizard, {});
    await page.getByLabelText('Admin secret').fill('secret');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect.element(page.getByRole('alert')).toMatchTextContent(/unexpected error/);
  });

  test('creates the first admin, then connects to GitHub, one step at a time', async () => {
    additionsSetup.status = createStatus();
    vi.mocked(saveAdmin).mockImplementation(async () => {
      additionsSetup.status = createStatus({ admins: 1 });
    });

    await render(SetupWizard, {});

    const createButton = page.getByRole('button', { name: 'Create Admin' });

    await expect.element(page.getByText('Step 1 of 2')).toBeVisible();
    await expect.element(page.getByText(/Create the first admin account\./)).toBeVisible();
    // GitHub waits for the admin
    expect(page.getByRole('button', { name: 'Connect to GitHub' }).elements()).toHaveLength(0);
    await expect.element(createButton).toHaveAttribute('aria-disabled', 'true');

    await page.getByRole('textbox', { name: 'Username' }).fill(' Kohei ');
    await page.getByLabelText('New password', { exact: true }).fill('short');
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The password is too short. Use at least 12 characters.');
    await page.getByLabelText('New password', { exact: true }).fill('admin password 2026');
    await createButton.click();

    await vi.waitFor(() =>
      expect(saveAdmin).toHaveBeenCalledWith({
        username: 'kohei',
        password: 'admin password 2026',
      }),
    );
    // The form makes way for the next step
    await expect.element(page.getByText('Step 2 of 2')).toBeVisible();
    await expect.element(page.getByRole('status')).toMatchTextContent(/The admin account is ready/);
    expect(page.getByLabelText('New password', { exact: true }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Connect to GitHub' }).click();
    await vi.waitFor(() =>
      expect(connectGitHub).toHaveBeenCalledWith({ repo: 'acme/site', replace: false }),
    );
  });

  test('sums up a service that’s set up', async () => {
    additionsSetup.status = createStatus({
      admins: 1,
      github_app: {
        slug: 'sveltia-cms-site',
        owner: 'acme',
        html_url: 'https://github.com/apps/x',
      },
      installation: { owner: 'acme', name: 'site' },
    });

    await render(SetupWizard, {});

    await expect.element(page.getByText(/Setup is complete\./)).toBeVisible();
    await expect.element(page.getByText('An admin account exists.')).toBeVisible();
    await expect
      .element(page.getByRole('group', { name: 'GitHub' }))
      .toMatchTextContent(
        'Connected to the “\u2068acme/site\u2069” repository with the “\u2068sveltia-cms-site\u2069” GitHub App.',
      );
    expect(page.getByText(/^Step/).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Connect to GitHub' }).elements()).toHaveLength(0);
    expect(page.getByLabelText('New password', { exact: true }).elements()).toHaveLength(0);
  });

  test('resets an admin’s password on a view of its own', async () => {
    additionsSetup.status = createStatus({ admins: 1 });

    await render(SetupWizard, {});
    await page.getByRole('button', { name: 'Reset Admin Password' }).click();

    const form = page.getByRole('form', { name: 'Admin Account' });

    await expect.element(form.getByRole('heading', { name: 'Admin Account' })).toHaveFocus();
    await expect.element(form.getByText(/An admin account already exists/)).toBeVisible();
    expect(page.getByRole('button', { name: 'Back to Sign In' }).elements()).toHaveLength(0);
    await form.getByRole('textbox', { name: 'Username' }).fill('kohei');
    await form.getByLabelText('New password', { exact: true }).fill('a new admin password');
    await form.getByRole('button', { name: 'Save Admin' }).click();

    await vi.waitFor(() =>
      expect(saveAdmin).toHaveBeenCalledWith({
        username: 'kohei',
        password: 'a new admin password',
      }),
    );
    // Back to the steps, with the outcome
    await expect.element(page.getByRole('status')).toMatchTextContent(/The admin account is ready/);
    await expect.element(page.getByRole('heading', { name: 'Admin Account' })).toHaveFocus();
    await expect.element(page.getByRole('button', { name: 'Back to Sign In' })).toBeVisible();
  });

  test('goes back from resetting a password without saving', async () => {
    additionsSetup.status = createStatus({ admins: 1 });

    await render(SetupWizard, {});
    await page.getByRole('button', { name: 'Reset Admin Password' }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();

    await expect.element(page.getByText('An admin account exists.')).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Admin Account' })).toHaveFocus();
    expect(saveAdmin).not.toHaveBeenCalled();
  });

  test('leaves an error behind when switching views', async () => {
    additionsSetup.status = createStatus({ admins: 1 });
    vi.mocked(saveAdmin).mockRejectedValueOnce(
      new Error('Short', { cause: { message: 'The password is too short.' } }),
    );

    await render(SetupWizard, {});
    await page.getByRole('button', { name: 'Reset Admin Password' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill('kohei');
    await page.getByLabelText('New password', { exact: true }).fill('a new admin password');
    await page.getByRole('button', { name: 'Save Admin' }).click();
    await expect.element(page.getByRole('alert')).toHaveTextContent('The password is too short.');

    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect.element(page.getByText('An admin account exists.')).toBeVisible();
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
  });

  test('manages the other sites on a view of their own', async () => {
    vi.mocked(unlockSetup).mockImplementation(async () => {
      additionsSetup.status = createStatus({ admins: 1 });
    });
    vi.mocked(listTenants).mockResolvedValueOnce([
      {
        id: 'acme',
        name: 'Acme Inc.',
        created_at: '2026-11-21T00:00:00.000Z',
        url: 'https://additions.example.com/t/acme',
      },
    ]);

    await render(SetupWizard, {});
    await page.getByLabelText('Admin secret').fill('the secret');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Manage Other Sites' }).click();

    const sites = page.getByRole('group', { name: 'Other Sites' });

    await expect.element(sites.getByRole('heading', { name: 'Other Sites' })).toHaveFocus();
    await expect.element(sites.getByRole('listitem')).toMatchTextContent(/Acme Inc\./);
    expect(page.getByRole('button', { name: 'Back to Sign In' }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect.element(sites).not.toBeInTheDocument();
    await expect.element(page.getByRole('heading', { name: 'Admin Account' })).toHaveFocus();
  });

  test('offers the other sites even with the stored secrets locked', async () => {
    vi.mocked(unlockSetup).mockImplementation(async () => {
      additionsSetup.status = createStatus({ data_key: 'locked', admins: 1 });
    });
    vi.mocked(listTenants).mockResolvedValueOnce([]);

    await render(SetupWizard, {});
    await page.getByLabelText('Admin secret').fill('the secret');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect.element(page.getByRole('heading', { name: 'Admin Secret Changed' })).toBeVisible();
    await page.getByRole('button', { name: 'Manage Other Sites' }).click();
    await expect.element(page.getByText('There are no other sites yet.')).toBeVisible();
  });

  test('doesn’t offer the other sites where they can’t be managed', async () => {
    vi.mocked(unlockSetup).mockImplementation(async () => {
      additionsSetup.status = createStatus();
    });

    await render(SetupWizard, {});
    await page.getByLabelText('Admin secret').fill('the secret');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect.element(page.getByText('Step 1 of 2')).toBeVisible();
    expect(listTenants).toHaveBeenCalledOnce();
    expect(page.getByRole('button', { name: 'Manage Other Sites' }).elements()).toHaveLength(0);
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
  });

  test('shows why the other sites couldn’t be listed', async () => {
    vi.mocked(unlockSetup).mockImplementation(async () => {
      additionsSetup.status = createStatus();
    });
    vi.mocked(listTenants).mockRejectedValueOnce(
      new Error('Wrong', { cause: { message: 'Something went wrong.' } }),
    );

    await render(SetupWizard, {});
    await page.getByLabelText('Admin secret').fill('the secret');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect.element(page.getByRole('alert')).toHaveTextContent('Something went wrong.');
    // Setting up this site still works
    await expect.element(page.getByText('Step 1 of 2')).toBeVisible();
  });

  test('registers a new app when the previous one lost its installation', async () => {
    additionsSetup.status = createStatus({
      admins: 1,
      github_app: { slug: 'old', owner: 'acme', html_url: 'https://github.com/apps/old' },
    });

    await render(SetupWizard, {});
    await page.getByRole('button', { name: 'Connect to GitHub' }).click();

    await vi.waitFor(() =>
      expect(connectGitHub).toHaveBeenCalledWith({ repo: 'acme/site', replace: true }),
    );
  });

  test('recovers the stored secrets after the admin secret was changed', async () => {
    additionsSetup.status = createStatus({ data_key: 'locked', admins: 1 });

    await render(SetupWizard, {});

    await expect.element(page.getByRole('heading', { name: 'Admin Secret Changed' })).toBeVisible();
    // The other steps need the stored secrets, so they wait
    expect(page.getByRole('heading', { name: 'Admin Account' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Connect to GitHub' }).elements()).toHaveLength(0);
    await page.getByLabelText('Previous admin secret').fill('old secret');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await vi.waitFor(() => expect(rewrapDataKey).toHaveBeenCalledWith('old secret'));

    await page.getByRole('button', { name: 'Start Over' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Start Over' });

    await expect.element(dialog).toMatchTextContent(/Passwords are kept/);
    await dialog.getByRole('button', { name: 'Start Over' }).click();
    await vi.waitFor(() => expect(rekeyDataKey).toHaveBeenCalledOnce());
  });

  test('goes back to the sign-in form', async () => {
    await render(SetupWizard, {});
    await page.getByRole('button', { name: 'Back to Sign In' }).click();

    expect(closeSetup).toHaveBeenCalledOnce();
  });
});
