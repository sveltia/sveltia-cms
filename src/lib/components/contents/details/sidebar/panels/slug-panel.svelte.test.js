import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import SlugPanel from './slug-panel.svelte';

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr', 'de'],
  initialLocales: ['en', 'fr'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

/**
 * Render the panel with a draft.
 * @param {object} args Arguments.
 * @param {any} [args.slug] The collection’s `slug` option.
 * @param {Record<string, any>} [args.draft] Draft properties to override.
 * @param {boolean} [args.localized] Whether to enable i18n.
 * @returns {Promise<any>} Draft.
 */
const renderPanel = async ({ slug = undefined, draft: draftProps = {}, localized = false }) => {
  const draft = createMockDraft({
    i18n: localized ? i18n : undefined,
    values: localized ? { en: {}, fr: {}, de: {} } : undefined,
    draft: localized
      ? { currentLocales: { en: true, fr: true, de: false }, ...draftProps }
      : draftProps,
  });

  /** @type {any} */ (draft.collection).slug = slug;

  await renderWithDraft(SlugPanel, { draft });

  return draft;
};

describe('SlugPanel', () => {
  test('shows the slug editor of a new entry, along with the hint', async () => {
    await renderPanel({
      slug: { editable: true, hint: 'A BCP-47 language code' },
      localized: true,
      draft: {
        slugEditor: { en: true, fr: 'readonly', de: 'readonly' },
        currentSlugs: { en: '', fr: '', de: '' },
      },
    });

    const panel = page.getByRole('group', { name: 'Slug' });

    await expect.element(panel.getByText('A BCP-47 language code')).toBeVisible();
    // The slug is shared by every locale, so there’s a single field without a locale heading
    await expect.element(panel.getByRole('textbox', { name: 'Slug' })).toBeRequired();
    expect(panel.getByRole('textbox').elements()).toHaveLength(1);
    expect(panel.getByRole('heading', { level: 4 }).elements()).toHaveLength(0);
  });

  test('shows a slug editor for each locale when the slug is localized', async () => {
    await renderPanel({
      slug: { editable: true, i18n: true },
      localized: true,
      draft: {
        slugEditor: { en: true, fr: true, de: true },
        currentSlugs: { en: '', fr: '', de: '' },
      },
    });

    const panel = page.getByRole('group', { name: 'Slug' });

    expect(
      panel
        .getByRole('heading', { level: 4 })
        .elements()
        .map((el) => el.textContent),
    ).toEqual(['English', 'French']);
    await expect.element(panel.getByRole('textbox', { name: 'English' })).toBeRequired();
    await expect.element(panel.getByRole('textbox', { name: 'French' })).toBeRequired();
  });

  test('shows the slug a new entry would be saved with', async () => {
    const draft = createMockDraft({
      i18n,
      values: { en: { title: 'Hello World' }, fr: { title: 'Bonjour' }, de: {} },
      draft: { currentLocales: { en: true, fr: true, de: false }, slugEditor: {} },
    });

    /** @type {any} */ (draft.collection).slug = '{{title | localize}}';

    await renderWithDraft(SlugPanel, { draft });

    const panel = page.getByRole('group', { name: 'Slug' });

    await expect
      .element(panel.getByRole('textbox', { name: 'English' }))
      .toHaveTextContent('hello-world');
    await expect
      .element(panel.getByRole('textbox', { name: 'French' }))
      .toHaveTextContent('bonjour');
    expect(panel.getByRole('button', { name: 'Edit Slug' }).elements()).toHaveLength(0);
    await expect.element(panel.getByText(/generated from the entry’s content/)).toBeVisible();

    draft.currentValues.fr.title = 'Salut';
    await expect.element(panel.getByRole('textbox', { name: 'French' })).toHaveTextContent('salut');
  });

  test('lets the slug of an existing entry be updated', async () => {
    await renderPanel({
      draft: { isNew: false, originalSlugs: { _: 'hello' }, currentSlugs: { _: 'hello' } },
    });

    const panel = page.getByRole('group', { name: 'Slug' });

    await expect.element(panel.getByRole('textbox', { name: 'Slug' })).toHaveTextContent('hello');
    await expect.element(panel.getByRole('button', { name: 'Edit Slug' })).toBeEnabled();
  });

  test('shows the slugs of an existing entry that can’t be updated', async () => {
    await renderPanel({
      slug: { template: '{{title | localize}}', editable: ['create'] },
      localized: true,
      draft: {
        isNew: false,
        currentSlugs: { en: 'hello', fr: 'bonjour', de: 'hallo', ja: undefined },
      },
    });

    const panel = page.getByRole('group', { name: 'Slug' });

    await expect
      .element(panel.getByRole('textbox', { name: 'English' }))
      .toHaveTextContent('hello');
    await expect
      .element(panel.getByRole('textbox', { name: 'French' }))
      .toHaveTextContent('bonjour');
    // A disabled locale, and a locale without a slug, are left out
    expect(panel.getByRole('textbox').elements()).toHaveLength(2);
    expect(panel.getByRole('button', { name: 'Edit Slug' }).elements()).toHaveLength(0);
  });

  test('falls back to the locale code when it has no label', async () => {
    const draft = createMockDraft({
      i18n: { ...i18n, allLocales: ['en', 'fr_CA'], initialLocales: ['en', 'fr_CA'] },
      values: { en: {}, fr_CA: {} },
      draft: { isNew: false, currentSlugs: { en: 'hello', fr_CA: 'bonjour' } },
    });

    /** @type {any} */ (draft.collection).slug = {
      template: '{{title | localize}}',
      editable: false,
    };

    await renderWithDraft(SlugPanel, { draft });

    await expect.element(page.getByRole('textbox', { name: 'fr_CA' })).toHaveTextContent('bonjour');
  });

  test('shows a locale-agnostic slug', async () => {
    await renderPanel({
      slug: { editable: false },
      draft: { isNew: false, currentSlugs: { _: 'hello' } },
    });

    const panel = page.getByRole('group', { name: 'Slug' });

    await expect.element(panel.getByRole('textbox', { name: 'Slug' })).toHaveTextContent('hello');
    expect(panel.getByRole('heading', { level: 4 }).elements()).toHaveLength(0);
  });

  test('says the collection’s index file has no slug', async () => {
    await renderPanel({ draft: { isIndexFile: true } });

    await expect.element(page.getByText('This entry doesn’t have a slug.')).toBeVisible();
  });
});
