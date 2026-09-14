import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { getCollection } from '$lib/services/contents/collection';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import EditSlugDialog from './edit-slug-dialog.svelte';

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr'],
  initialLocales: ['en', 'fr'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

/**
 * Render the dialog.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @param {object} [options] Options.
 * @param {string} [options.collectionName] Collection name.
 * @param {any} [options.i18nConfig] I18n configuration.
 * @returns {Promise<{ draft: any, props: any }>} Draft and props.
 */
const renderDialog = async (
  draftProps = {},
  { collectionName = 'posts', i18nConfig = undefined } = {},
) => {
  const draft = createMockDraft({
    collectionName,
    i18n: i18nConfig,
    values: i18nConfig ? { en: {}, fr: {} } : undefined,
    draft: { collection: getCollection(collectionName), ...draftProps },
  });

  const props = $state({ open: true });

  // Wait for the dialog of the previous test to be gone, so the locators don’t pick it up
  await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
  await renderWithDraft(EditSlugDialog, { draft, props });

  return { draft, props };
};

describe('EditSlugDialog', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'pages',
          label: 'Pages',
          folder: 'content/pages',
          nested: { depth: 3 },
          meta: { path: { widget: 'string', index_file: 'index' } },
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'guides',
          label: 'Guides',
          folder: 'content/guides',
          nested: { depth: 3 },
          meta: { path: { widget: 'string', index_file: 'index' } },
          // The folder is named after the localized title
          slug: '{{title | localize}}',
          i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
          fields: [{ name: 'title', widget: 'string', i18n: true }],
        },
      ],
    });
    setEntries([
      createMockEntry({ slug: 'hello' }),
      createMockEntry({ slug: 'world' }),
      createMockEntry({ slug: 'docs/index', folder: 'content/pages' }),
      createMockEntry({ slug: 'docs/guides/index', folder: 'content/pages' }),
      createMockEntry({ slug: 'docs/api/index', folder: 'content/pages' }),
      // Sibling folders of the localized guides, one of them in the default locale only
      createMockEntry({
        slug: 'docs/api/index',
        folder: 'content/guides',
        content: { en: {}, fr: {} },
        entry: {
          locales: {
            en: { slug: 'docs/api/index', path: 'content/guides/docs/api/index.md', content: {} },
            fr: {
              slug: 'docs/api-fr/index',
              path: 'content/guides/docs/api-fr/index.md',
              content: {},
            },
          },
        },
      }),
      createMockEntry({ slug: 'docs/faq/index', folder: 'content/guides', content: { en: {} } }),
    ]);
  });

  beforeEach(() => {
    unpublishedEntries.current = [];
  });

  test('edits and slugifies the slug', async () => {
    const { draft } = await renderDialog({ currentSlugs: { _default: 'hello' } });
    const dialog = page.getByRole('dialog', { name: 'Edit Slug' });
    const input = dialog.getByRole('textbox');
    const update = dialog.getByRole('button', { name: 'Update' });

    await expect.element(input).toHaveValue('hello');
    await expect.element(update).toBeDisabled();
    // A single locale has no heading
    expect(dialog.getByRole('heading', { level: 3 }).elements()).toHaveLength(0);

    await input.fill('Hello World');
    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
    await expect
      .element(
        dialog.getByText(
          'The slug cannot contain special characters, including slashes and spaces.',
        ),
      )
      .toBeInTheDocument();
    await expect.element(update).toBeDisabled();

    await input.fill('');
    await expect.element(dialog.getByText('The slug cannot be empty.')).toBeInTheDocument();

    // The slug of another entry is taken
    await input.fill('world');
    await expect
      .element(dialog.getByText('This slug is used for another entry.'))
      .toBeInTheDocument();

    await input.fill('Héllo');
    await expect.element(input).toHaveAttribute('aria-invalid', 'false');
    await update.click();

    await expect.poll(() => draft.currentSlugs).toEqual({ _default: 'héllo' });
  });

  test('takes the slugs of the unpublished entries into account', async () => {
    unpublishedEntries.current = [
      /** @type {any} */ ({
        ...createMockEntry({ slug: 'draft' }),
        workflow: { status: 'draft', collectionName: 'posts' },
      }),
    ];

    await renderDialog({ currentSlugs: { _default: 'hello' } });

    const dialog = page.getByRole('dialog');

    await dialog.getByRole('textbox').fill('draft');
    await expect
      .element(dialog.getByText('This slug is used for another entry.'))
      .toBeInTheDocument();
  });

  test('edits the slug of each locale', async () => {
    const { draft } = await renderDialog(
      { currentSlugs: { en: 'hello', fr: 'bonjour' } },
      { i18nConfig: i18n },
    );

    const dialog = page.getByRole('dialog');

    expect(
      dialog
        .getByRole('heading', { level: 3 })
        .elements()
        .map((el) => el.textContent),
    ).toEqual(['English', 'French']);

    await dialog.getByRole('textbox').nth(1).fill('salut');
    await dialog.getByRole('button', { name: 'Update' }).click();

    await expect.poll(() => draft.currentSlugs).toEqual({ en: 'hello', fr: 'salut' });
  });

  test('renames the folder of an entry stored as an index file', async () => {
    const { draft } = await renderDialog(
      {
        isNew: false,
        originalEntry: createMockEntry({ slug: 'docs/guides/index', folder: 'content/pages' }),
        currentPath: 'docs/guides',
        currentSlugs: { _default: 'docs/guides/index' },
      },
      { collectionName: 'pages' },
    );

    const dialog = page.getByRole('dialog');
    const input = dialog.getByRole('textbox');
    const update = dialog.getByRole('button', { name: 'Update' });

    await expect.element(input).toHaveValue('guides');
    await expect.element(update).toBeDisabled();

    // A sibling folder’s name is taken
    await input.fill('api');
    await expect
      .element(dialog.getByText('A folder with this name already exists here.'))
      .toBeInTheDocument();
    await expect.element(update).toBeDisabled();

    await input.fill('User Guides');
    await expect.element(update).toBeEnabled();
    await update.click();

    await expect.poll(() => draft.currentPath).toBe('docs/user-guides');
  });

  test('renames the localized folders of an entry stored as an index file', async () => {
    const { draft } = await renderDialog(
      {
        isNew: false,
        originalEntry: createMockEntry({ slug: 'docs/guides/index', folder: 'content/guides' }),
        currentPath: 'docs/guides',
        currentSlugs: { en: 'docs/guides/index', fr: 'docs/guides-fr/index' },
        currentLocales: { en: true, fr: true },
      },
      { collectionName: 'guides', i18nConfig: i18n },
    );

    const dialog = page.getByRole('dialog');

    expect(
      dialog
        .getByRole('heading', { level: 3 })
        .elements()
        .map((el) => el.textContent),
    ).toEqual(['English', 'French']);
    await expect.element(dialog.getByRole('textbox').nth(0)).toHaveValue('guides');
    await expect.element(dialog.getByRole('textbox').nth(1)).toHaveValue('guides-fr');

    // The folders next to the entry’s own are taken in each locale
    await dialog.getByRole('textbox').nth(0).fill('api');
    await expect.element(dialog.getByRole('textbox').nth(0)).toBeInvalid();
    await dialog.getByRole('textbox').nth(0).fill('guides');
    await expect.element(dialog.getByRole('textbox').nth(0)).toBeValid();
    await dialog.getByRole('textbox').nth(1).fill('api-fr');
    await expect.element(dialog.getByRole('textbox').nth(1)).toBeInvalid();
    await expect.element(dialog.getByRole('button', { name: 'Update' })).toBeDisabled();

    await dialog.getByRole('textbox').nth(1).fill('Manuels');
    await expect.element(dialog.getByRole('textbox').nth(1)).toHaveValue('Manuels');
    await expect.element(dialog.getByRole('button', { name: 'Update' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Update' }).click();

    // The folder is renamed within the localized slug, leaving the file name in place
    await expect
      .poll(() => draft.currentSlugs)
      .toEqual({ en: 'docs/guides/index', fr: 'docs/manuels/index' });
    expect(draft.currentPath).toBe('docs/guides');
  });

  test('falls back to the locale code when it has no label', async () => {
    const i18nConfig = { ...i18n, allLocales: ['en', 'fr_CA'], initialLocales: ['en', 'fr_CA'] };

    /**
     * Get the headings.
     * @returns {(string | null)[]} Headings.
     */
    const getHeadings = () =>
      page
        .getByRole('dialog')
        .getByRole('heading', { level: 3 })
        .elements()
        .map((el) => el.textContent);

    const { props } = await renderDialog(
      { currentSlugs: { en: 'hello', fr_CA: 'bonjour' } },
      { i18nConfig },
    );

    await expect.poll(getHeadings).toEqual(['English', 'fr_CA']);
    props.open = false;

    await renderDialog(
      {
        isNew: false,
        originalEntry: createMockEntry({ slug: 'docs/guides/index', folder: 'content/guides' }),
        currentPath: 'docs/guides',
        currentSlugs: { en: 'docs/guides/index', fr_CA: 'docs/guides-fr/index' },
        currentLocales: { en: true, fr_CA: true },
      },
      { collectionName: 'guides', i18nConfig },
    );

    await expect.poll(getHeadings).toEqual(['English', 'fr_CA']);
  });
});
