import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { goBack, goto } from '$lib/services/app/navigation';
import { env } from '$lib/services/user/env.svelte';

import Sidebar from './sidebar.svelte';

vi.mock('$lib/services/app/navigation', async (importOriginal) => ({
  ...(await importOriginal()),
  goto: vi.fn(),
  goBack: vi.fn(),
}));

const SECTIONS = [
  { key: 'users', labelKey: 'additions.users.title', icon: 'group' },
  { key: 'config', labelKey: 'cms_config', icon: 'data_object' },
];

describe('Sidebar', () => {
  afterEach(() => {
    env.isSmallScreen = false;
  });

  test('lists the sections, with the one shown selected', async () => {
    await render(Sidebar, { sections: SECTIONS, selectedKey: 'users' });

    const list = page
      .getByRole('navigation', { name: 'Administration' })
      .getByRole('listbox', { name: 'Administration' });

    await expect
      .element(list.getByRole('option', { name: 'Users' }))
      .toHaveAttribute('aria-selected', 'true');
    await expect
      .element(list.getByRole('option', { name: 'CMS Configuration' }))
      .toHaveAttribute('aria-selected', 'false');
    // The title is in the global toolbar on a large screen, with no way back beside the sections
    expect(page.getByRole('toolbar').elements()).toHaveLength(0);
    // The sections are shown next to the list
    await expect
      .element(page.getByRole('listbox', { name: 'Administration' }))
      .toHaveAttribute('aria-controls', 'admin-container');

    await list.getByRole('option', { name: 'CMS Configuration' }).click();
    expect(goto).toHaveBeenCalledWith('/admin/config', { transitionType: 'forwards' });
  });

  test('is the whole page on a small screen, with no section selected', async () => {
    env.isSmallScreen = true;

    await render(Sidebar, { sections: SECTIONS, selectedKey: '' });

    await expect.element(page.getByRole('toolbar')).toMatchTextContent(/Administration/);
    await expect
      .element(page.getByRole('option', { name: 'Users' }))
      .toHaveAttribute('aria-selected', 'false');
    // Nothing is shown beside it
    await expect
      .element(page.getByRole('listbox', { name: 'Administration' }))
      .not.toHaveAttribute('aria-controls');

    // It leads back to the Menu page, where it was opened from
    await page.getByRole('button', { name: 'Back' }).click();
    expect(goBack).toHaveBeenCalledWith('/menu');
  });
});
