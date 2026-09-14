import { addMessages, locale } from '@sveltia/i18n';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import BackButton from './back-button.svelte';

describe('BackButton', () => {
  // Register a right-to-left locale, without strings, so it can be switched to
  beforeAll(() => {
    addMessages('ar', {});
  });

  afterEach(() => {
    locale.set('en-US');
  });

  test('is labelled “Back” by default', async () => {
    await render(BackButton, {});

    await expect.element(page.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  test('accepts a custom label', async () => {
    await render(BackButton, { 'aria-label': 'Close' });

    await expect.element(page.getByRole('button', { name: 'Close' })).toBeVisible();
  });

  test('shows an arrow pointing to the start, following the text direction', async () => {
    expect((await render(BackButton, {})).container).toHaveTextContent('arrow_back');

    locale.set('ar');

    expect((await render(BackButton, {})).container).toHaveTextContent('arrow_forward');
  });

  test('calls the click handler', async () => {
    const onclick = vi.fn();

    await render(BackButton, { onclick });
    await page.getByRole('button').click();

    expect(onclick).toHaveBeenCalledOnce();
  });

  test('is triggered by the Escape key only when the shortcut is enabled', async () => {
    const onclick = vi.fn();

    await render(BackButton, { onclick });
    await userEvent.keyboard('{Escape}');
    expect(onclick).not.toHaveBeenCalled();

    await render(BackButton, { onclick, useShortcut: true });
    await userEvent.keyboard('{Escape}');
    expect(onclick).toHaveBeenCalledOnce();
  });
});
