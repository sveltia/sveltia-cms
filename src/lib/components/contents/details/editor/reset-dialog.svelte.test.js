import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ResetDialog from './reset-dialog.svelte';

describe('ResetDialog', () => {
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
});
