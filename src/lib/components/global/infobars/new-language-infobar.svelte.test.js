import { addMessages } from '@sveltia/i18n';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { setState } from '$lib/services/app/onboarding';
import { backendName } from '$lib/services/backends';
import { repository } from '$lib/services/backends/git/github/repository';
import { prefs } from '$lib/services/user/prefs.svelte';

import NewLanguageInfobar from './new-language-infobar.svelte';

const { language } = navigator;

/**
 * Pretend the browser is set to the given language.
 * @param {string} value Language tag.
 */
const setNavigatorLanguage = (value) => {
  Object.defineProperty(navigator, 'language', { value, configurable: true });
};

describe('NewLanguageInfobar', () => {
  beforeAll(() => {
    // Register Japanese, without strings, so it counts as an available UI language
    addMessages('ja', {});
  });

  afterEach(() => {
    setNavigatorLanguage(language);
  });

  test('offers to switch to the browser’s language once the preference is loaded', async () => {
    setNavigatorLanguage('ja-JP');
    prefs.locale = 'en-US';

    const { container } = await render(NewLanguageInfobar, {});

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'info Information Sveltia CMS is now available in \u2068日本語\u2069! Change Language Later',
      );

    await page.getByRole('button', { name: 'Change Language' }).click();
    expect(prefs.locale).toBe('ja');
    await expect.poll(() => container.querySelector('.infobar')).toBeNull();
  });

  test('can be put off', async () => {
    setNavigatorLanguage('ja-JP');
    prefs.locale = 'en-US';

    const { container } = await render(NewLanguageInfobar, {});

    await page.getByRole('button', { name: 'Later' }).click();
    expect(prefs.locale).toBe('en-US');
    await expect.poll(() => container.querySelector('.infobar')).toBeNull();
  });

  test('stays hidden while the language follows the browser', async () => {
    setNavigatorLanguage('ja-JP');
    prefs.locale = 'auto';

    const { container } = await render(NewLanguageInfobar, {});

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(container.querySelector('.infobar')).toBeNull();
  });

  test('stays hidden when the browser’s language is already in use', async () => {
    setNavigatorLanguage('en-US');
    prefs.locale = 'en-US';

    const { container } = await render(NewLanguageInfobar, {});

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(container.querySelector('.infobar')).toBeNull();
  });

  test('stays hidden when the browser’s language isn’t available', async () => {
    setNavigatorLanguage('de-DE');
    prefs.locale = 'en-US';

    const { container } = await render(NewLanguageInfobar, {});

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(container.querySelector('.infobar')).toBeNull();
  });

  test('stays hidden once dismissed', async () => {
    setNavigatorLanguage('ja-JP');
    prefs.locale = 'en-US';
    backendName.current = 'github';
    Object.assign(repository, { databaseName: 'sveltia-cms-test-onboarding' });

    try {
      await setState('newLanguageCta', true);

      const { container } = await render(NewLanguageInfobar, {});

      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });
      expect(container.querySelector('.infobar')).toBeNull();
    } finally {
      backendName.current = undefined;
      Object.assign(repository, { databaseName: '' });
    }
  });
});
