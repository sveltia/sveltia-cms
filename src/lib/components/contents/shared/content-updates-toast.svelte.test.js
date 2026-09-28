import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { waitForToastsToHide } from '$lib/test/toast';

import ContentUpdatesToast from './content-updates-toast.svelte';

describe('ContentUpdatesToast', () => {
  test('reports the content updates', async () => {
    await render(ContentUpdatesToast, {});

    contentUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      count: 2,
      saved: true,
      published: true,
    };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success 2 entries saved and published.');
    // The toast goes away on its own, resetting the state
    await waitForToastsToHide();
    expect(contentUpdatesToast.current.saved).toBe(false);

    contentUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      count: 1,
      deleted: true,
      deletionPending: true,
    };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Entry marked for deletion.');
    await waitForToastsToHide();

    contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, count: 1, discarded: true };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Changes discarded.');
    await waitForToastsToHide();

    contentUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      count: 1,
      deletionCancelled: true,
    };
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Deletion cancelled.');
    await waitForToastsToHide();
  }, 40000);
});
