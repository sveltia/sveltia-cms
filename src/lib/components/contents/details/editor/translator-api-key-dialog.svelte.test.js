import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showContentOverlay, translatorApiKeyDialogState } from '$lib/services/contents/editor';
import { prefs } from '$lib/services/user/prefs.svelte';

import TranslatorApiKeyDialog from './translator-api-key-dialog.svelte';

/**
 * Paste text into an input, firing an `input` event as the browser does on a paste.
 * @param {HTMLInputElement} input Input element.
 * @param {string} text Text to paste.
 */
const pasteInto = (input, text) => {
  input.value = text;
  input.dispatchEvent(
    new InputEvent('input', { inputType: 'insertFromPaste', data: text, bubbles: true }),
  );
};

describe('TranslatorApiKeyDialog', () => {
  beforeEach(() => {
    showContentOverlay.current = true;
    prefs.apiKeys = {};
    prefs.defaultTranslationService = 'google';
    translatorApiKeyDialogState.current = { show: false, multiple: false };
  });

  afterEach(async () => {
    // Let the dialog finish closing, so its close handler doesn’t settle the next test’s request
    translatorApiKeyDialogState.current.show = false;
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
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

    // An invalid key can’t be confirmed: the dialog would close, leaving the translation waiting
    await expect.element(dialog.getByRole('button', { name: 'OK' })).toBeDisabled();

    // A Google Cloud API key
    const apiKey = 'AIzaSyA1234567890abcdefghijklmnopqrstuvwxyz'.slice(0, 39);

    // Typing a valid key doesn’t save it until it’s confirmed
    await input.fill(apiKey);
    await expect.element(input).toHaveValue(apiKey);
    expect(resolve).not.toHaveBeenCalled();
    expect(prefs.apiKeys?.google).toBeUndefined();

    await expect.element(dialog.getByRole('button', { name: 'OK' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'OK' }).click();
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(apiKey));
    expect(prefs.apiKeys?.google).toBe(apiKey);
    expect(translatorApiKeyDialogState.current.show).toBe(false);

    // The translation isn’t settled again once the dialog has closed
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(resolve).toHaveBeenCalledOnce();
  });

  test('saves a pasted API key without confirmation', async () => {
    const resolve = vi.fn();

    await render(TranslatorApiKeyDialog);

    translatorApiKeyDialogState.current = { show: true, multiple: false, resolve };

    const dialog = page.getByRole('alertdialog', { name: 'Translate Field' });
    const input = dialog.getByRole('textbox', { name: 'API Key' });

    await expect.element(input).toBeInTheDocument();

    // Pasting an invalid key changes nothing
    pasteInto(/** @type {HTMLInputElement} */ (input.element()), 'invalid');
    await expect.element(input).toHaveValue('invalid');
    expect(resolve).not.toHaveBeenCalled();
    expect(prefs.apiKeys?.google).toBeUndefined();

    // A Google Cloud API key
    const apiKey = 'AIzaSyA1234567890abcdefghijklmnopqrstuvwxyz'.slice(0, 39);

    pasteInto(/** @type {HTMLInputElement} */ (input.element()), apiKey);
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(apiKey));
    expect(prefs.apiKeys?.google).toBe(apiKey);
    expect(translatorApiKeyDialogState.current.show).toBe(false);
  });

  test('doesn’t cut short a key being typed that already matches the pattern', async () => {
    const resolve = vi.fn();

    prefs.defaultTranslationService = 'anthropic';

    await render(TranslatorApiKeyDialog);

    translatorApiKeyDialogState.current = { show: true, multiple: false, resolve };

    const dialog = page.getByRole('alertdialog', { name: 'Translate Field' });
    const input = dialog.getByRole('textbox', { name: 'API Key' });

    await expect
      .element(dialog.getByRole('combobox', { name: 'Select Service' }))
      .toHaveTextContent('Anthropic Claude');

    // A fake Anthropic API key, valid after the first 40 characters following the prefix
    const apiKey = `sk-ant-api03-${'a1B2c3D4e5'.repeat(5)}`;

    await userEvent.type(input, apiKey);
    await expect.element(input).toHaveValue(apiKey);
    expect(resolve).not.toHaveBeenCalled();
    expect(prefs.apiKeys?.anthropic).toBeUndefined();

    await dialog.getByRole('button', { name: 'OK' }).click();
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(apiKey));
    expect(resolve).toHaveBeenCalledOnce();
    expect(prefs.apiKeys?.anthropic).toBe(apiKey);
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
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(undefined));
    resolve.mockClear();

    // Dismissed with the Escape key, with an invalid key entered
    translatorApiKeyDialogState.current = { show: true, multiple: false, resolve };

    const input = page.getByRole('alertdialog').getByRole('textbox', { name: 'API Key' });

    await input.fill('invalid');
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(undefined));
    expect(prefs.apiKeys?.google).toBeUndefined();
    resolve.mockClear();

    translatorApiKeyDialogState.current = { show: true, multiple: false, resolve };
    await expect.element(page.getByRole('alertdialog')).toBeInTheDocument();

    showContentOverlay.current = false;
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(undefined));
    expect(translatorApiKeyDialogState.current.show).toBe(false);
  });
});
