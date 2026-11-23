import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ResetDialog from './reset-dialog.svelte';

const fields = [{ name: 'title', widget: 'string', i18n: true, default: 'Untitled' }];
const i18n = { i18nEnabled: true, defaultLocale: 'en', allLocales: ['en', 'fr'] };

describe('ResetDialog', () => {
  beforeAll(async () => {
    // Reverting looks the fields up in the site configuration to tell the translatable ones
    await initTestConfig({
      i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
      collections: [{ name: 'posts', folder: 'content/posts', i18n: true, fields }],
    });
  });

  test('restores the default values in a locale once confirmed', async () => {
    const draft = createMockDraft({
      fields: [{ name: 'title', widget: 'string', i18n: true, default: 'Untitled' }],
      i18n: { i18nEnabled: true, defaultLocale: 'en', allLocales: ['en', 'fr'] },
      values: { en: { title: 'Hello' }, fr: { title: 'Bonjour' } },
    });

    const props = $state({ open: true, action: /** @type {const} */ ('restore'), locale: 'fr' });

    await renderWithDraft(ResetDialog, { draft, props });

    const dialog = page.getByRole('alertdialog');

    await expect
      .element(dialog)
      .toMatchTextContent(
        'restore the default values of all the fields in the \u2068French\u2069 content',
      );
    await dialog.getByRole('button', { name: 'Restore Default' }).click();

    await expect.poll(() => draft.currentValues.fr.title).toBe('Untitled');
    expect(draft.currentValues.en.title).toBe('Hello');
    await expect.poll(() => props.open).toBe(false);
  });

  test('reverts the changes in every locale once confirmed', async () => {
    const draft = createMockDraft({
      fields,
      i18n,
      values: { en: { title: 'Hello' }, fr: { title: 'Bonjour' } },
    });

    draft.currentValues.en.title = 'Hello!';
    draft.currentValues.fr.title = 'Bonjour !';

    const onClose = vi.fn();
    const props = $state({ open: true, action: /** @type {const} */ ('revert'), onClose });

    await renderWithDraft(ResetDialog, { draft, props });

    const dialog = page.getByRole('alertdialog', { name: 'Revert All Changes' });

    await expect.element(dialog).toMatchTextContent('revert all the changes made to this entry?');
    await dialog.getByRole('button', { name: 'Revert All Changes' }).click();

    await expect.poll(() => draft.currentValues.en.title).toBe('Hello');
    expect(draft.currentValues.fr.title).toBe('Bonjour');
    await expect.poll(() => props.open).toBe(false);
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  test('reverts the changes in a locale only', async () => {
    const draft = createMockDraft({
      fields,
      i18n,
      values: { en: { title: 'Hello' }, fr: { title: 'Bonjour' } },
    });

    draft.currentValues.en.title = 'Hello!';
    draft.currentValues.fr.title = 'Bonjour !';

    const props = $state({ open: true, action: /** @type {const} */ ('revert'), locale: 'fr' });

    await renderWithDraft(ResetDialog, { draft, props });

    // The scope is a single locale, so the label doesn’t say “all”
    const dialog = page.getByRole('alertdialog', { name: 'Revert Changes' });

    await expect
      .element(dialog)
      .toMatchTextContent('revert all the changes made to the \u2068French\u2069 content?');
    await dialog.getByRole('button', { name: 'Revert Changes' }).click();

    await expect.poll(() => draft.currentValues.fr.title).toBe('Bonjour');
    expect(draft.currentValues.en.title).toBe('Hello!');
  });

  test('clears the fields in every locale once confirmed', async () => {
    const draft = createMockDraft({
      fields,
      i18n,
      values: { en: { title: 'Hello' }, fr: { title: 'Bonjour' } },
    });

    const props = $state({ open: true, action: /** @type {const} */ ('clear') });

    await renderWithDraft(ResetDialog, { draft, props });

    const dialog = page.getByRole('alertdialog', { name: 'Clear All' });

    await expect.element(dialog).toMatchTextContent('clear all the fields in this entry?');
    await dialog.getByRole('button', { name: 'Clear All' }).click();

    await expect.poll(() => draft.currentValues.en.title).toBe('');
    expect(draft.currentValues.fr.title).toBe('');
  });

  test('leaves the values alone when cancelled', async () => {
    const draft = createMockDraft({
      fields,
      i18n,
      values: { en: { title: 'Hello' }, fr: { title: 'Bonjour' } },
    });

    const onClose = vi.fn();
    const props = $state({ open: true, action: /** @type {const} */ ('clear'), onClose });

    await renderWithDraft(ResetDialog, { draft, props });
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

    await expect.poll(() => props.open).toBe(false);
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(draft.currentValues.en.title).toBe('Hello');
    expect(draft.currentValues.fr.title).toBe('Bonjour');
  });
});
