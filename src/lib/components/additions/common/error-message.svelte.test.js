import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ErrorMessage from './error-message.svelte';

describe('ErrorMessage', () => {
  test('announces the message as an alert, and shows nothing without one', async () => {
    const props = $state({ message: '' });

    await render(ErrorMessage, props);
    expect(page.getByRole('alert').elements()).toHaveLength(0);

    props.message = 'The current password is wrong.';
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The current password is wrong.');
  });

  test('shows nothing without the prop', async () => {
    await render(ErrorMessage, {});
    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });
});
