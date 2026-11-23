import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import RemoveButton from './remove-button.svelte';

describe('RemoveButton', () => {
  test('renders a small iconic Remove button that can be clicked', async () => {
    const onclick = vi.fn();

    await render(RemoveButton, { onclick });

    const button = page.getByRole('button', { name: 'Remove' });

    await expect.element(button).toBeEnabled();
    await expect.element(button).toHaveClass('small');
    await expect.element(button).not.toHaveClass('ghost');
    await button.click();
    expect(onclick).toHaveBeenCalledOnce();
  });

  test('takes a variant and a size', async () => {
    await render(RemoveButton, { variant: 'ghost', size: 'medium' });

    const button = page.getByRole('button', { name: 'Remove' });

    await expect.element(button).toHaveClass('ghost');
    await expect.element(button).toHaveClass('medium');
  });

  test('can be disabled', async () => {
    await render(RemoveButton, { disabled: true });

    await expect.element(page.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  test('can be hidden', async () => {
    await render(RemoveButton, { hidden: true });

    const button = page.getByRole('button', { name: 'Remove', includeHidden: true });

    await expect.element(button).toBeInTheDocument();
    await expect.element(button).not.toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });
});
