import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { additionsUsers } from '$lib/services/additions/users.svelte';
import { loadAdditions } from '$lib/services/app/additions';
import { goBack } from '$lib/services/app/navigation';
import { cmsConfig } from '$lib/services/config';
import { env } from '$lib/services/user/env.svelte';

import MainArea from './main-area.svelte';

vi.mock('$lib/services/app/navigation', async (importOriginal) => ({
  ...(await importOriginal()),
  goBack: vi.fn(),
}));

const children = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<p>Content</p>',
}));

const actions = createRawSnippet(() => ({
  /**
   * Render the buttons.
   * @returns {string} HTML.
   */
  render: () => '<button>Act</button>',
}));

describe('MainArea', () => {
  beforeEach(() => {
    additionsUsers.update = undefined;
    env.isSmallScreen = false;
  });

  afterEach(() => {
    env.isSmallScreen = false;
    cmsConfig.current = undefined;
  });

  test('shows the title, the actions and the content', async () => {
    await render(MainArea, { title: 'Users', actions, children });

    const main = page.getByRole('main', { name: 'Users' });

    await expect.element(main.getByRole('toolbar', { name: 'Users' })).toMatchTextContent(/Users/);
    await expect.element(main.getByRole('button', { name: 'Act' })).toBeVisible();
    await expect.element(main.getByText('Content')).toBeVisible();
    // No way back on a large screen, where the sections are listed beside
    expect(main.getByRole('button', { name: 'Back' }).elements()).toHaveLength(0);
  });

  test('leads back to the Menu page, which lists the sections, on a small screen', async () => {
    env.isSmallScreen = true;

    await render(MainArea, { title: 'Users', children });
    await page.getByRole('button', { name: 'Back' }).click();

    expect(goBack).toHaveBeenCalledWith('/menu');
  });

  test('has the release notice of Sveltia CMS Additions only with it', async () => {
    additionsUsers.update = { current: '0.1.0', latest: '0.2.0' };

    await render(MainArea, { title: 'Users', children });

    expect(page.getByText(/Sveltia CMS Additions .0\.2\.0. is available/).elements()).toHaveLength(
      0,
    );

    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github', repo: 'acme/site', auth_type: 'additions' },
    });
    await loadAdditions();

    await expect
      .element(page.getByRole('main', { name: 'Users' }).getByText(/0\.2\.0. is available/))
      .toBeVisible();
  });
});
