import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showContentOverlay, translatorApiKeyDialogState } from '$lib/services/contents/editor';
import { prefs } from '$lib/services/user/prefs.svelte';

import TranslatorApiKeyDialog from './translator-api-key-dialog.svelte';

describe('TranslatorApiKeyDialog', () => {
  beforeEach(() => {
    showContentOverlay.current = true;
    prefs.apiKeys = {};
    prefs.defaultTranslationService = 'google';
    translatorApiKeyDialogState.current = { show: false, multiple: false };
  });

  test('saves a valid API key for the selected service', async () => {
    const resolve = vi.fn();

    await render(TranslatorApiKeyDialog);

    translatorApiKeyDialogState.current = { show: true, multiple: true, resolve };

    const dialog = page.getByRole('alertdialog', { name: 'Translate Fields' });

    await expect.element(dialog).toBeInTheDocument();
    await expect
      .element(dialog.getByRole('combobox', { name: 'Select Service' }))
      .toHaveTextContent('Google Cloud Translation');
    await expect
      .element(dialog.getByRole('link', { name: 'Cloud Translation API' }))
      .toHaveAttribute(
        'href',
        'https://console.cloud.google.com/apis/library/translate.googleapis.com',
      );

    const input = dialog.getByRole('textbox', { name: 'API Key' });

    await input.fill('invalid');
    expect(resolve).not.toHaveBeenCalled();

    // Confirming an invalid key changes nothing either
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(resolve).not.toHaveBeenCalled();

    translatorApiKeyDialogState.current = { show: true, multiple: true, resolve };
    await expect.element(dialog).toBeInTheDocument();

    // A Google Cloud API key
    const apiKey = 'AIzaSyA1234567890abcdefghijklmnopqrstuvwxyz'.slice(0, 39);

    await input.fill(apiKey);
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(apiKey));
    expect(prefs.apiKeys?.google).toBe(apiKey);
    expect(translatorApiKeyDialogState.current.show).toBe(false);
  });

  test('shows the saved key of the selected service', async () => {
    prefs.apiKeys = { google: 'saved-key' };

    await render(TranslatorApiKeyDialog);

    translatorApiKeyDialogState.current = { show: true, multiple: false, resolve: vi.fn() };

    const dialog = page.getByRole('alertdialog', { name: 'Translate Field' });

    await expect.element(dialog.getByRole('textbox', { name: 'API Key' })).toHaveValue('saved-key');

    prefs.defaultTranslationService = 'mistral';
    await expect.element(dialog.getByRole('textbox', { name: 'API Key' })).toHaveValue('');
  });

  test('resolves with nothing when cancelled or when the editor is closed', async () => {
    const resolve = vi.fn();

    await render(TranslatorApiKeyDialog);

    translatorApiKeyDialogState.current = { show: true, multiple: false, resolve };
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith());

    translatorApiKeyDialogState.current = { show: true, multiple: false, resolve };
    await expect.element(page.getByRole('alertdialog')).toBeInTheDocument();

    showContentOverlay.current = false;
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));
    expect(translatorApiKeyDialogState.current.show).toBe(false);
  });
});
