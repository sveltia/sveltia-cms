import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import SlugEditor from './slug-editor.svelte';

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr'],
  initialLocales: ['en', 'fr'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

/**
 * Create a draft of a new entry whose slug is filled by the `{{title}}` template.
 * @param {Record<string, any>} [options] Options for `createMockDraft`.
 * @param {any} [slug] The collection’s `slug` option.
 * @returns {any} Draft.
 */
const createTemplateDraft = (options = {}, slug = { template: '{{title}}' }) => {
  const draft = createMockDraft({
    values: { _default: { title: 'Hello World' } },
    draft: { slugEditor: { _default: true }, currentSlugs: {} },
    ...options,
  });

  /** @type {any} */ (draft.collection).slug = slug;

  return draft;
};

describe('SlugEditor', () => {
  describe('with a slug that has to be typed in', () => {
    test('writes the slug to the draft, along with the read-only locales', async () => {
      const draft = createMockDraft({
        i18n,
        values: { en: {}, fr: {} },
        draft: { slugEditor: { en: true, fr: 'readonly' }, currentSlugs: { en: '', fr: '' } },
      });

      // The slug is only given with the slug editor
      /** @type {any} */ (draft.collection).slug = { editable: true };

      await renderWithDraft(SlugEditor, { draft, props: { locale: 'en' } });

      const group = page.getByRole('group');
      const input = group.getByRole('textbox', { name: 'Slug' });

      await expect.element(input).toBeRequired();
      await expect.element(group.getByText('*')).toHaveAttribute('aria-hidden', 'true');
      expect(group.getByRole('button', { name: 'Edit Slug' }).elements()).toHaveLength(0);

      await input.fill('hello-world');
      await expect.poll(() => draft.currentSlugs).toEqual({ en: 'hello-world', fr: 'hello-world' });

      // A slug changed elsewhere, e.g. by reverting the changes, is shown
      draft.currentSlugs = {};
      await expect.element(input).toHaveValue('');
      draft.currentSlugs = { en: 'restored', fr: 'restored' };
      await expect.element(input).toHaveValue('restored');
    });

    test('shows nothing in a read-only locale until the slug is typed in', async () => {
      const draft = createMockDraft({
        i18n,
        values: { en: {}, fr: {} },
        draft: { slugEditor: { en: true, fr: 'readonly' }, currentSlugs: {} },
      });

      /** @type {any} */ (draft.collection).slug = { editable: true };

      await renderWithDraft(SlugEditor, { draft, props: { locale: 'fr' } });

      const value = page.getByRole('textbox', { name: 'Slug' });

      // No random ID is made up for the slug
      await expect.element(value).toHaveTextContent('');
      expect(page.getByRole('button', { name: 'Edit Slug' }).elements()).toHaveLength(0);

      draft.currentSlugs = { en: 'hello', fr: 'hello' };
      await expect.element(value).toHaveTextContent('hello');
    });

    test('is labelled with the given element instead of a heading of its own', async () => {
      const draft = createMockDraft({
        i18n,
        values: { en: {}, fr: {} },
        draft: { slugEditor: { en: true, fr: 'readonly' }, currentSlugs: {} },
      });

      /** @type {any} */ (draft.collection).slug = { editable: true };

      const label = document.createElement('span');

      label.id = 'external-label';
      label.textContent = 'English';
      document.body.append(label);

      await renderWithDraft(SlugEditor, {
        draft,
        props: { locale: 'en', ariaLabelledby: 'external-label' },
      });

      await expect.element(page.getByRole('textbox', { name: 'English' })).toBeRequired();
      expect(page.getByText('*').elements()).toHaveLength(0);

      label.remove();
    });
  });

  describe('with a slug the template fills', () => {
    test('shows the slug the template fills, which follows the entry', async () => {
      const draft = createTemplateDraft();

      await renderWithDraft(SlugEditor, { draft, props: { locale: '_default' } });

      const value = page.getByRole('textbox', { name: 'Slug' });

      await expect.element(value).toHaveTextContent('hello-world');
      await expect.element(value).toHaveAttribute('aria-readonly', 'true');
      await expect.element(value).not.toBeRequired();
      expect(page.getByText('*').elements()).toHaveLength(0);

      draft.currentValues._default.title = 'Hello Again';
      await expect.element(value).toHaveTextContent('hello-again');
      // The slug the template fills isn’t written to the draft, so it’s filled again when saved
      expect(draft.currentSlugs).toEqual({});
    });

    test('edits the slug with the pencil button', async () => {
      const draft = createTemplateDraft();

      await renderWithDraft(SlugEditor, { draft, props: { locale: '_default' } });

      await page.getByRole('button', { name: 'Edit Slug' }).click();

      const input = page.getByRole('textbox', { name: 'Slug' });
      const done = page.getByRole('button', { name: 'Done' });

      await expect.element(input).toHaveValue('hello-world');
      await expect.element(input).toHaveFocus();

      // The slug is checked as it’s typed
      await input.fill('my slug');
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          'error The slug cannot contain special characters, including slashes and spaces.',
        );
      await expect.element(input).toHaveAttribute('aria-invalid', 'true');
      await expect.element(done).toBeDisabled();
      // The Enter key doesn’t apply an invalid slug
      await userEvent.keyboard('{Enter}');
      await expect.element(input).toBeInTheDocument();

      await input.fill('my-slug');
      await expect.element(done).toBeEnabled();
      await userEvent.keyboard('{Enter}');

      await expect.poll(() => draft.currentSlugs).toEqual({ _default: 'my-slug' });

      const value = page.getByRole('textbox', { name: 'Slug' });

      await expect.element(value).toHaveTextContent('my-slug');

      // The given slug no longer follows the template
      draft.currentValues._default.title = 'Another Title';
      await expect.element(value).toHaveTextContent('my-slug');

      // An empty slug goes back to the template, whose slug is shown while editing
      await page.getByRole('button', { name: 'Edit Slug' }).click();
      await page.getByRole('textbox', { name: 'Slug' }).fill('');
      await expect
        .element(page.getByRole('textbox', { name: 'Slug' }))
        .toHaveAttribute('placeholder', 'another-title');
      await page.getByRole('button', { name: 'Done' }).click();
      await expect.poll(() => draft.currentSlugs).toEqual({ _default: '' });
      await expect
        .element(page.getByRole('textbox', { name: 'Slug' }))
        .toHaveTextContent('another-title');
    });

    test('leaves the slug as is when the editing is cancelled or nothing is changed', async () => {
      const draft = createTemplateDraft();

      await renderWithDraft(SlugEditor, { draft, props: { locale: '_default' } });

      await page.getByRole('button', { name: 'Edit Slug' }).click();
      await page.getByRole('textbox', { name: 'Slug' }).fill('changed');
      await userEvent.keyboard('{Escape}');
      await expect
        .element(page.getByRole('textbox', { name: 'Slug' }))
        .toHaveTextContent('hello-world');

      await page.getByRole('button', { name: 'Edit Slug' }).click();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'Edit Slug' }).click();
      await page.getByRole('button', { name: 'Done' }).click();

      // The slug the template fills isn’t frozen
      expect(draft.currentSlugs).toEqual({});
    });

    test('checks the edited slug against the pattern', async () => {
      const draft = createTemplateDraft(undefined, {
        template: '{{title}}',
        pattern: ['^[a-z]{2}$', 'Must be a two-letter code'],
      });

      await renderWithDraft(SlugEditor, { draft, props: { locale: '_default' } });

      await page.getByRole('button', { name: 'Edit Slug' }).click();
      await page.getByRole('textbox', { name: 'Slug' }).fill('deu');
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent('error Must be a two-letter code');
    });

    test('shows a slug given before it was rendered', async () => {
      const draft = createTemplateDraft({
        values: { _default: { title: 'Hello World' } },
        draft: { slugEditor: { _default: true }, currentSlugs: { _default: 'given-slug' } },
      });

      await renderWithDraft(SlugEditor, { draft, props: { locale: '_default' } });

      await expect
        .element(page.getByRole('textbox', { name: 'Slug' }))
        .toHaveTextContent('given-slug');
    });

    test('shows the slug of a read-only locale, which can’t be edited', async () => {
      const draft = createMockDraft({
        i18n,
        values: { en: { title: 'Hello World' }, fr: { title: 'Bonjour' } },
        draft: {
          slugEditor: { en: true, fr: 'readonly' },
          currentSlugs: {},
          validities: { en: {}, fr: { _slug: { valid: false, valueMissing: true } } },
        },
      });

      /** @type {any} */ (draft.collection).slug = { template: '{{title}}' };

      await renderWithDraft(SlugEditor, { draft, props: { locale: 'fr' } });

      const value = page.getByRole('textbox', { name: 'Slug' });

      // The slug isn’t localized, so every locale shares the default locale’s
      await expect.element(value).toHaveTextContent('hello-world');
      // A read-only slug is never invalid
      await expect.element(value).toHaveAttribute('aria-invalid', 'false');
      expect(page.getByRole('alert').elements()).toHaveLength(0);
      expect(page.getByRole('button', { name: 'Edit Slug' }).elements()).toHaveLength(0);

      draft.currentSlugs = { en: 'salut', fr: 'salut' };
      await expect.element(value).toHaveTextContent('salut');
    });

    test('shows the validation errors', async () => {
      const draft = createTemplateDraft({
        values: { _default: { title: 'Hello World' } },
        draft: {
          slugEditor: { _default: true },
          currentSlugs: { _default: 'a b' },
          validities: {
            _default: {
              _slug: /** @type {any} */ ({
                valid: false,
                patternMismatch: true,
                customErrorMessage:
                  'The slug cannot contain special characters, including slashes and spaces.',
              }),
            },
          },
        },
      });

      await renderWithDraft(SlugEditor, { draft, props: { locale: '_default' } });

      const value = page.getByRole('textbox', { name: 'Slug' });

      await expect.element(value).toHaveAttribute('aria-invalid', 'true');
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          'error The slug cannot contain special characters, including slashes and spaces.',
        );

      draft.validities._default._slug = /** @type {any} */ ({
        valid: false,
        customError: true,
        customErrorMessage: 'Must be a BCP-47 code',
      });
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent('error Must be a BCP-47 code');
    });
  });

  test('renders nothing without a draft', async () => {
    const { container } = await renderWithDraft(SlugEditor, {
      draft: /** @type {any} */ (null),
      props: { locale: 'en' },
    });

    expect(container.children).toHaveLength(0);
  });
});
