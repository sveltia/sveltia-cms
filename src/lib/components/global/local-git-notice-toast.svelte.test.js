import { tick } from 'svelte';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { localGitNotice } from '$lib/services/backends/fs/git';
import { waitForToastsToHide } from '$lib/test/toast';

import LocalGitNoticeToast from './local-git-notice-toast.svelte';

describe('LocalGitNoticeToast', () => {
  test('shows nothing until changes aren’t committed', async () => {
    localGitNotice.current = undefined;

    const { container } = await render(LocalGitNoticeToast, {});

    expect(container.children).toHaveLength(0);
  });

  test('doesn’t show again a notice from before it was mounted', async () => {
    // e.g. before the user signed out and in again
    localGitNotice.current = { reason: 'staged_changes' };
    await render(LocalGitNoticeToast, {});

    // Let the effects run, which would show the toast
    await tick();
    expect(document.querySelector('.sui.toast')).toBeNull();
    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });

  test('tells why the changes weren’t committed, every time it happens', async () => {
    localGitNotice.current = undefined;
    await render(LocalGitNoticeToast, {});

    localGitNotice.current = { reason: 'staged_changes' };
    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent(
        'Your changes have been saved but not committed to Git. \u2068You have other changes staged for commit. Commit or unstage them first.\u2069 To only save the files, turn off Git commits under Settings > Developer.',
      );
    await waitForToastsToHide();

    // Another notice shows the toast again, with the details
    localGitNotice.current = { reason: 'lfs', detail: 'static/images/a.png' };
    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent(
        'Your changes have been saved but not committed to Git. \u2068\u2068static/images/a.png\u2069 is tracked with Git LFS, which the CMS can’t commit to.\u2069 To only save the files, turn off Git commits under Settings > Developer.',
      );
    await expect.element(page.getByRole('alert')).toBeVisible();
    await waitForToastsToHide();
  }, 20000);
});
