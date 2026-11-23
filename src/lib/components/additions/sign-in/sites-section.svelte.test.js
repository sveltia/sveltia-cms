import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createTenant, deleteTenant } from '$lib/services/additions/tenants';

import SitesSection from './sites-section.svelte';

// The section talks to Sveltia CMS Additions; the ID check is real, the requests are not
vi.mock('$lib/services/additions/tenants', async (importOriginal) => ({
  ...(await importOriginal()),
  createTenant: vi.fn(),
  deleteTenant: vi.fn(),
}));

/**
 * Create a site as the service lists it.
 * @param {string} id ID.
 * @param {string} [name] Name.
 * @returns {import('$lib/services/additions/tenants').Tenant} Site.
 */
const createSite = (id, name = id) => ({
  id,
  name,
  created_at: '2026-11-21T00:00:00.000Z',
  url: `https://additions.example.com/t/${id}`,
});

describe('SitesSection', () => {
  test('says when there are no other sites', async () => {
    await render(SitesSection, { tenants: [] });

    await expect.element(page.getByRole('group', { name: 'Other Sites' })).toBeVisible();
    await expect.element(page.getByText('There are no other sites yet.')).toBeVisible();
    await expect.element(page.getByRole('listitem')).not.toBeInTheDocument();
  });

  test('lists the sites with their URLs', async () => {
    await render(SitesSection, { tenants: [createSite('acme', 'Acme Inc.'), createSite('beta')] });

    const items = page.getByRole('listitem');

    await expect.element(items.nth(0)).toMatchTextContent(/Acme Inc\./);
    await expect
      .element(items.nth(0))
      .toMatchTextContent(/https:\/\/additions\.example\.com\/t\/acme/);
    await expect.element(items.nth(1)).toMatchTextContent(/beta/);
    await expect.element(page.getByText('There are no other sites yet.')).not.toBeInTheDocument();
  });

  test('adds a site once its ID is valid', async () => {
    const acme = createSite('acme', 'Acme Inc.');

    vi.mocked(createTenant).mockResolvedValue(acme);

    await render(SitesSection, { tenants: [createSite('beta')] });

    const addButton = page.getByRole('button', { name: 'Add Site' });
    const idInput = page.getByRole('textbox', { name: 'Site ID' });

    await expect.element(addButton).toHaveAttribute('aria-disabled', 'true');
    await expect.element(idInput).toHaveAccessibleDescription(/lower-case letters/);
    await idInput.fill('ac me');
    await expect.element(addButton).toHaveAttribute('aria-disabled', 'true');
    await idInput.fill('default');
    await expect.element(addButton).toHaveAttribute('aria-disabled', 'true');
    // Lower-cased, like a username
    await idInput.fill(' Acme ');
    await page.getByRole('textbox', { name: 'Name (optional)' }).fill(' Acme Inc. ');
    await addButton.click();

    await vi.waitFor(() =>
      expect(createTenant).toHaveBeenCalledWith({ id: 'acme', name: 'Acme Inc.' }),
    );
    await expect
      .element(page.getByRole('status').filter({ hasText: 'has been added' }))
      .toMatchTextContent(/Acme Inc\..* has been added/);
    // Listed by ID
    await expect.element(page.getByRole('listitem').nth(0)).toMatchTextContent(/Acme Inc\./);
    await expect.element(page.getByRole('listitem').nth(1)).toMatchTextContent(/beta/);
    // The form is ready for the next site
    await expect.element(idInput).toHaveValue('');
    await expect.element(page.getByRole('textbox', { name: 'Name (optional)' })).toHaveValue('');
  });

  test('shows why a site couldn’t be added', async () => {
    vi.mocked(createTenant).mockRejectedValue(
      new Error('Taken', { cause: { message: 'A site with this ID already exists.' } }),
    );

    await render(SitesSection, { tenants: [] });
    await page.getByRole('textbox', { name: 'Site ID' }).fill('acme');
    await page.getByRole('button', { name: 'Add Site' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('A site with this ID already exists.');
    // The ID is kept, to correct it
    await expect.element(page.getByRole('textbox', { name: 'Site ID' })).toHaveValue('acme');
  });

  test('copies a site’s URL', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    await render(SitesSection, { tenants: [createSite('acme', 'Acme Inc.')] });
    await page.getByRole('button', { name: /Copy the URL of .*Acme Inc\./ }).click();

    expect(writeText).toHaveBeenCalledWith('https://additions.example.com/t/acme');
    // The button says so, which is announced
    await expect
      .element(page.getByRole('status').filter({ hasText: 'Copied' }))
      .toBeInTheDocument();
  });

  test('says when the URL couldn’t be copied', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Denied'));

    await render(SitesSection, { tenants: [createSite('acme')] });
    await page.getByRole('button', { name: /Copy the URL of .*acme/ }).click();

    await expect.element(page.getByRole('alert')).toHaveTextContent('Couldn’t copy to clipboard.');
    expect(page.getByRole('status').filter({ hasText: 'Copied' }).elements()).toHaveLength(0);

    // Gone once a copy works
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue();
    await page.getByRole('button', { name: /Copy the URL of .*acme/ }).click();
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
  });

  test('keeps the error of a request when a URL is copied', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    vi.mocked(createTenant).mockRejectedValue(
      new Error('Exists', { cause: { message: 'A site with this ID already exists.' } }),
    );

    await render(SitesSection, { tenants: [createSite('acme')] });
    await page.getByRole('textbox', { name: 'Site ID' }).fill('acme');
    await page.getByRole('button', { name: 'Add Site' }).click();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('A site with this ID already exists.');

    await page.getByRole('button', { name: /Copy the URL of .*acme/ }).click();
    await expect
      .element(page.getByRole('status').filter({ hasText: 'Copied' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('A site with this ID already exists.');
  });

  test('deletes a site once its ID is typed', async () => {
    const acme = createSite('acme', 'Acme Inc.');

    vi.mocked(createTenant).mockResolvedValue(acme);

    await render(SitesSection, { tenants: [createSite('beta')] });

    // Add it first, so the message about it goes when it’s deleted
    await page.getByRole('textbox', { name: 'Site ID' }).fill('acme');
    await page.getByRole('button', { name: 'Add Site' }).click();
    await expect
      .element(page.getByRole('status').filter({ hasText: 'has been added' }))
      .toMatchTextContent(/has been added/);

    await page.getByRole('button', { name: /Delete .*Acme Inc\./ }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Site' });
    const okButton = dialog.getByRole('button', { name: 'Delete Site' });

    await expect.element(dialog).toMatchTextContent(/This can’t be undone\./);
    await expect.element(okButton).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Site ID to confirm' }).fill('beta');
    await expect.element(okButton).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Site ID to confirm' }).fill(' acme ');
    await expect.element(okButton).toBeEnabled();
    await okButton.click();

    await vi.waitFor(() => expect(deleteTenant).toHaveBeenCalledWith('acme'));
    await expect.element(page.getByRole('listitem')).toMatchTextContent(/beta/);
    await expect
      .element(page.getByRole('status').filter({ hasText: 'has been added' }))
      .not.toBeInTheDocument();
  });

  test('keeps the message about another site when one is deleted', async () => {
    const acme = createSite('acme');

    vi.mocked(createTenant).mockResolvedValue(acme);

    await render(SitesSection, { tenants: [createSite('beta')] });
    await page.getByRole('textbox', { name: 'Site ID' }).fill('acme');
    await page.getByRole('button', { name: 'Add Site' }).click();
    await expect
      .element(page.getByRole('status').filter({ hasText: 'has been added' }))
      .toMatchTextContent(/has been added/);

    await page.getByRole('button', { name: /Delete .*beta/ }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Site' });

    await dialog.getByRole('textbox', { name: 'Site ID to confirm' }).fill('beta');
    await dialog.getByRole('button', { name: 'Delete Site' }).click();

    await vi.waitFor(() => expect(deleteTenant).toHaveBeenCalledWith('beta'));
    await expect.poll(() => page.getByRole('listitem').elements().length).toBe(1);
    await expect
      .element(page.getByRole('status').filter({ hasText: 'has been added' }))
      .toMatchTextContent(/has been added/);
  });

  test('closes the confirmation without deleting', async () => {
    await render(SitesSection, { tenants: [createSite('acme')] });
    await page.getByRole('button', { name: /Delete .*acme/ }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Site' });

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.element(dialog).not.toBeInTheDocument();
    expect(deleteTenant).not.toHaveBeenCalled();
  });
});
