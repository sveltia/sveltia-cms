import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import SlugEditor from './slug-editor.svelte';

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr'],
  initialLocales: ['en', 'fr'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

describe('SlugEditor', () => {
  test('writes the slug to the draft, along with the read-only locales', async () => {
    const draft = createMockDraft({
      i18n,
      values: { en: {}, fr: {} },
      draft: { slugEditor: { en: true, fr: 'readonly' }, currentSlugs: { en: '', fr: '' } },
    });

    await renderWithDraft(SlugEditor, { draft, props: { locale: 'en' } });

    const group = page.getByRole('group');
    const input = group.getByRole('textbox', { name: 'Slug' });

    await expect.element(input).toBeRequired();
    await expect.element(group.getByText('*')).toHaveAttribute('aria-hidden', 'true');

    await input.fill('hello-world');
    await expect.poll(() => draft.currentSlugs).toEqual({ en: 'hello-world', fr: 'hello-world' });
  });

  test('shows the slug of a read-only locale', async () => {
    const draft = createMockDraft({
      i18n,
      values: { en: {}, fr: {} },
      draft: {
        slugEditor: { en: true, fr: 'readonly' },
        currentSlugs: { en: 'hello', fr: 'bonjour' },
        validities: { en: {}, fr: { _slug: { valid: false, valueMissing: true } } },
      },
    });

    await renderWithDraft(SlugEditor, { draft, props: { locale: 'fr' } });

    const input = page.getByRole('textbox', { name: 'Slug' });

    await expect.element(input).toHaveValue('bonjour');
    await expect.element(input).toHaveAttribute('readonly');
    // A read-only slug is never invalid
    await expect.element(input).toHaveAttribute('aria-invalid', 'false');
    expect(page.getByRole('alert').elements()).toHaveLength(0);

    draft.currentSlugs.fr = 'salut';
    await expect.element(input).toHaveValue('salut');

    // The slug is only set once the entry is saved
    draft.currentSlugs.fr = undefined;
    await expect.element(input).toHaveValue('');
  });

  test('renders nothing without a draft', async () => {
    const { container } = await renderWithDraft(SlugEditor, {
      draft: /** @type {any} */ (null),
      props: { locale: 'en' },
    });

    expect(container.children).toHaveLength(0);
  });

  test('shows the validation errors', async () => {
    const draft = createMockDraft({
      draft: {
        slugEditor: { _default: false },
        currentSlugs: { _default: 'a b' },
        validities: {
          _default: { _slug: { valid: false, valueMissing: false, patternMismatch: true } },
        },
      },
    });

    await renderWithDraft(SlugEditor, { draft, props: { locale: '_default' } });

    const input = page.getByRole('textbox', { name: 'Slug' });

    await expect.element(input).not.toBeRequired();
    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'error The slug cannot contain special characters, including slashes and spaces.',
      );

    draft.validities._default._slug = { valid: false, valueMissing: true };
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error The slug cannot be empty.');
  });
});
