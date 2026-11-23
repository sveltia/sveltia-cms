import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { waitForToastsToHide } from '$lib/test/toast';

import ValidationErrorsToast from './validation-errors-toast.svelte';

describe('ValidationErrorsToast', () => {
  test('tells how many fields have errors, without a button by default', async () => {
    const props = $state({ show: true, count: 2 });

    await render(ValidationErrorsToast, props);

    await expect.element(page.getByRole('alert')).toMatchTextContent(/2\D? fields have errors\./);
    expect(page.getByRole('button', { name: 'Show Errors' }).query()).toBeNull();

    // The toast hides itself after a few seconds, which is written back to the bound prop
    await waitForToastsToHide();
    expect(props.show).toBe(false);
  });

  test('hides itself and calls back when Show Errors is clicked', async () => {
    const onShowErrors = vi.fn();
    const props = $state({ show: true, count: 1, onShowErrors });

    await render(ValidationErrorsToast, props);
    await page.getByRole('button', { name: 'Show Errors' }).click();

    expect(onShowErrors).toHaveBeenCalledOnce();
    await expect.poll(() => props.show).toBe(false);
  });
});
