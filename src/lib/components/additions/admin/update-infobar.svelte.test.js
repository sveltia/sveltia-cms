import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { additionsUsers } from '$lib/services/additions/users.svelte';
import { openNewTab } from '$lib/services/utils/window';

import UpdateInfobar from './update-infobar.svelte';

vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));

describe('UpdateInfobar', () => {
  beforeEach(() => {
    additionsUsers.update = undefined;
  });

  test('says nothing without a newer release', async () => {
    await render(UpdateInfobar);

    expect(page.getByRole('status').elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Release Notes' }).elements()).toHaveLength(0);
  });

  test('tells admins about a newer release of Sveltia CMS Additions', async () => {
    additionsUsers.update = { current: '0.1.0', latest: '0.2.0' };

    await render(UpdateInfobar);

    await expect
      .element(page.getByText(/Sveltia CMS Additions .0\.2\.0. is available/))
      .toBeVisible();
    await page.getByRole('button', { name: 'Release Notes' }).click();
    expect(openNewTab).toHaveBeenCalledWith(
      'https://github.com/sveltia/sveltia-cms-additions/releases',
    );
  });
});
