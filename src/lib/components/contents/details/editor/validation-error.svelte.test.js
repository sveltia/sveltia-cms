import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ValidationError from './validation-error.svelte';

/**
 * Snippet rendering the error message.
 */
const children = createRawSnippet(() => ({
  /**
   * Render the message.
   * @returns {string} HTML.
   */
  render: () => '<span>This field is required.</span>',
}));

describe('ValidationError', () => {
  test('announces the message as a polite alert', async () => {
    await render(ValidationError, { children });

    const alert = page.getByRole('alert');

    await expect.element(alert.getByText('This field is required.')).toBeVisible();
    await expect.element(alert).toHaveAttribute('aria-live', 'polite');
    await expect.element(alert).not.toHaveAttribute('id');
  });

  test('can be referenced by the field and silenced', async () => {
    await render(ValidationError, { id: 'title-error', live: 'off', children });

    const alert = page.getByRole('alert');

    await expect.element(alert).toHaveAttribute('id', 'title-error');
    await expect.element(alert).toHaveAttribute('aria-live', 'off');
  });

  test('shows an error icon', async () => {
    const { container } = await render(ValidationError, { children });

    expect(container.querySelector('.icon')).toHaveTextContent('error');
  });
});
