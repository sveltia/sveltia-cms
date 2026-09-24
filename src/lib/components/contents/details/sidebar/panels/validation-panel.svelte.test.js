import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { env } from '$lib/services/user/env.svelte';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ValidationPanel from './validation-panel.svelte';

const fields = [
  { name: 'title', label: 'Title', widget: 'string', required: true },
  { name: 'body', widget: 'text', pattern: ['^.{10,}$', 'Too short'] },
  { name: 'note', widget: 'string', required: false },
];

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr'],
  initialLocales: ['en', 'fr'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

describe('ValidationPanel', () => {
  beforeAll(async () => {
    // The fields are looked up in the site configuration
    await initTestConfig({
      i18n: {
        structure: /** @type {const} */ ('multiple_folders'),
        locales: ['en', 'fr'],
        default_locale: 'en',
      },
      collections: [
        { name: 'posts', label: 'Posts', folder: 'content/posts', i18n: true, fields },
        { name: 'pages', label: 'Pages', folder: 'content/pages', fields },
      ],
    });
  });

  test('validates the entry and lists the errors per locale', async () => {
    const draft = createMockDraft({
      fields,
      i18n,
      values: {
        // A value without a field, which can be left in a file by hand, is not validated
        en: { title: '', body: 'short', note: 'fine', stray: 'x' },
        fr: { title: 'Bonjour', body: 'assez long, oui', note: '' },
      },
    });

    await renderWithDraft(ValidationPanel, { draft });

    const panel = page.getByRole('group', { name: 'Validation' });

    await expect.element(panel.getByText('Validation results will be shown here.')).toBeVisible();

    await panel.getByRole('button', { name: 'Validate' }).click();

    const english = panel.getByRole('group').nth(0);
    const french = panel.getByRole('group').nth(1);

    await expect.element(english.getByRole('heading', { level: 4 })).toHaveTextContent('English');
    expect(
      english
        .getByRole('button')
        .elements()
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['Title error This field is required.', 'body error Too short']);
    await expect.element(french.getByText('No errors found.')).toBeInTheDocument();

    // Clicking an error highlights the field
    const postMessage = vi.spyOn(window, 'postMessage');

    await english.getByRole('button', { name: /Title/ }).click();
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'highlight-editor-field', payload: { locale: 'en', keyPath: 'title' } },
      window.location.origin,
    );
  });

  test('hands the selected field over when asked to', async () => {
    const onSelectField = vi.fn();
    const postMessage = vi.spyOn(window, 'postMessage');

    await renderWithDraft(ValidationPanel, {
      draft: createMockDraft({
        collectionName: 'pages',
        fields,
        values: { _default: { title: '', body: 'long enough text' } },
      }),
      props: { onSelectField },
    });
    await page.getByRole('button', { name: 'Validate' }).click();
    await page.getByRole('button', { name: /Title/ }).click();

    expect(onSelectField).toHaveBeenCalledExactlyOnceWith({ locale: '_default', keyPath: 'title' });
    expect(postMessage).not.toHaveBeenCalled();
  });

  test('has nothing to validate without a draft', async () => {
    await renderWithDraft(ValidationPanel, { draft: /** @type {any} */ (null) });

    await expect.element(page.getByRole('button', { name: 'Validate' })).toBeDisabled();
    await expect.element(page.getByText('Validation results will be shown here.')).toBeVisible();
  });

  test('reports a valid entry', async () => {
    const draft = createMockDraft({
      collectionName: 'pages',
      fields,
      values: { _default: { title: 'Hello', body: 'long enough text' } },
    });

    await renderWithDraft(ValidationPanel, { draft });
    await page.getByRole('button', { name: 'Validate' }).click();

    await expect.element(page.getByText('No errors found.')).toBeInTheDocument();
    // A single locale has no heading
    expect(page.getByRole('heading', { level: 4 }).elements()).toHaveLength(0);
  });

  test('lists a slug error, which opens the Slug panel', async () => {
    env.isSmallScreen = false;

    const draft = createMockDraft({
      fields,
      values: { _default: { title: 'Hello', body: 'long enough, yes', note: '' } },
      draft: { slugEditor: { _default: true }, currentSlugs: { _default: '' } },
    });

    // The slug is only given with the slug editor, so it’s required
    /** @type {any} */ (draft.collection).slug = { editable: true };

    await renderWithDraft(ValidationPanel, { draft });

    const panel = page.getByRole('group', { name: 'Validation' });

    await panel.getByRole('button', { name: 'Validate' }).click();

    const slugButton = panel.getByRole('button', { name: /Slug/ });

    await expect.element(slugButton).toMatchTextContent(/Slug.*The slug cannot be empty\./);
    await slugButton.click();
    expect(entryEditorSettings.current?.sidebarPanel).toBe('slug');
  });
});
