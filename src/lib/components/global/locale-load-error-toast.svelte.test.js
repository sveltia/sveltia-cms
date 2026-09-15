import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { appLocaleLoadError } from '$lib/services/app/i18n';
import { waitForToastsToHide } from '$lib/test/toast';

import LocaleLoadErrorToast from './locale-load-error-toast.svelte';

describe('LocaleLoadErrorToast', () => {
  test('shows nothing while the locale strings load fine', async () => {
    appLocaleLoadError.current = undefined;

    const { container } = await render(LocaleLoadErrorToast, {});

    expect(container.children).toHaveLength(0);
  });

  test('reports a locale that failed to load, by its name', async () => {
    appLocaleLoadError.current = { locale: 'ja' };

    await render(LocaleLoadErrorToast, {});

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'error Error Couldn’t load the \u2068Japanese\u2069 translation. Please try again later.',
      );
    await waitForToastsToHide();

    // A locale without a name is reported by its code
    appLocaleLoadError.current = { locale: 'xx_YY' };
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'error Error Couldn’t load the \u2068xx_YY\u2069 translation. Please try again later.',
      );
    await waitForToastsToHide();
  }, 20000);
});
