import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { getCollection } from '$lib/services/contents/collection';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import SlugUpdateForm from './slug-update-form.svelte';

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr'],
  initialLocales: ['en', 'fr'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

/**
 * Render the form.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @param {object} [options] Options.
 * @param {string} [options.collectionName] Collection name.
 * @param {any} [options.i18nConfig] I18n configuration.
 * @returns {Promise<{ draft: any, unmount: () => void }>} Draft and a function to unmount the
 * form.
 */
const renderForm = async (
  draftProps = {},
  { collectionName = 'posts', i18nConfig = undefined } = {},
) => {
  const draft = createMockDraft({
    collectionName,
    i18n: i18nConfig,
    values: i18nConfig ? { en: {}, fr: {} } : undefined,
    draft: { collection: getCollection(collectionName), ...draftProps },
  });

  const { unmount } = await renderWithDraft(SlugUpdateForm, { draft });

  return { draft, unmount };
};

describe('SlugUpdateForm', () => {
  beforeAll(async () => {
    await initTestConfig({
      // Only the collections with the `i18n` option are multilingual
      i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'languages',
          label: 'Languages',
          folder: 'content/languages',
          slug: { editable: true, pattern: ['^[a-z]{2}$', 'Must be a two-letter code'] },
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
          i18n: true,
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
            en: {
              slug: 'docs/api/index',
              path: 'content/guides/en/docs/api/index.md',
              content: {},
            },
            fr: {
              slug: 'docs/api-fr/index',
              path: 'content/guides/fr/docs/api-fr/index.md',
              content: {},
            },
          },
        },
      }),
      createMockEntry({
        slug: 'docs/faq/index',
        folder: 'content/guides',
        content: { en: {} },
        entry: {
          locales: {
            en: {
              slug: 'docs/faq/index',
              path: 'content/guides/en/docs/faq/index.md',
              content: {},
            },
          },
        },
      }),
    ]);
  });

  beforeEach(() => {
    unpublishedEntries.current = [];
  });

  test('edits and slugifies the slug', async () => {
    const { draft } = await renderForm({ currentSlugs: { _default: 'hello' } });

    // The only slug needs no heading
    expect(page.getByRole('heading', { level: 4 }).elements()).toHaveLength(0);
    await expect.element(page.getByRole('textbox', { name: 'Slug' })).toHaveTextContent('hello');

    await page.getByRole('button', { name: 'Edit Slug' }).click();

    const input = page.getByRole('textbox', { name: 'Slug' });
    const done = page.getByRole('button', { name: 'Done' });

    await expect.element(input).toHaveValue('hello');

    await input.fill('Hello World');
    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
    await expect
      .element(
        page.getByText('The slug cannot contain special characters, including slashes and spaces.'),
      )
      .toBeInTheDocument();
    await expect.element(done).toBeDisabled();

    await input.fill('');
    await expect.element(page.getByText('The slug cannot be empty.')).toBeInTheDocument();

    // The slug of another entry is taken
    await input.fill('world');
    await expect
      .element(page.getByText('This slug is used for another entry.'))
      .toBeInTheDocument();
    // The Enter key doesn’t apply an invalid slug
    await userEvent.keyboard('{Enter}');
    await expect.element(input).toBeInTheDocument();

    await input.fill('Héllo');
    await expect.element(input).toHaveAttribute('aria-invalid', 'false');
    await done.click();

    await expect.poll(() => draft.currentSlugs).toEqual({ _default: 'héllo' });
    await expect.element(page.getByRole('textbox', { name: 'Slug' })).toHaveTextContent('héllo');
  });

  test('leaves the slug as is when nothing is changed', async () => {
    const { draft } = await renderForm({ currentSlugs: { _default: 'Unique' } });

    await page.getByRole('button', { name: 'Edit Slug' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    // The slug isn’t slugified again
    await expect.element(page.getByRole('textbox', { name: 'Slug' })).toHaveTextContent('Unique');
    expect(draft.currentSlugs).toEqual({ _default: 'Unique' });
  });

  test('checks the slug against the pattern option', async () => {
    const { draft } = await renderForm(
      { currentSlugs: { _default: 'de' }, originalSlugs: { _default: 'de' } },
      { collectionName: 'languages' },
    );

    await page.getByRole('button', { name: 'Edit Slug' }).click();

    const input = page.getByRole('textbox', { name: 'Slug' });

    await input.fill('deu');
    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
    await expect.element(page.getByText('Must be a two-letter code')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Done' })).toBeDisabled();

    await input.fill('fr');
    await expect.element(input).toHaveAttribute('aria-invalid', 'false');
    await page.getByRole('button', { name: 'Done' }).click();

    await expect.poll(() => draft.currentSlugs).toEqual({ _default: 'fr' });
  });

  test('takes the slugs of the unpublished entries into account', async () => {
    unpublishedEntries.current = [
      /** @type {any} */ ({
        ...createMockEntry({ slug: 'draft' }),
        workflow: { status: 'draft', collectionName: 'posts' },
      }),
    ];

    await renderForm({ currentSlugs: { _default: 'hello' } });

    await page.getByRole('button', { name: 'Edit Slug' }).click();
    await page.getByRole('textbox', { name: 'Slug' }).fill('draft');
    await expect
      .element(page.getByText('This slug is used for another entry.'))
      .toBeInTheDocument();
  });

  test('edits the slug of each locale', async () => {
    const { draft } = await renderForm(
      { currentSlugs: { en: 'Hello', fr: 'bonjour' } },
      { i18nConfig: i18n },
    );

    expect(
      page
        .getByRole('heading', { level: 4 })
        .elements()
        .map((el) => el.textContent),
    ).toEqual(['English', 'French']);

    await page.getByRole('button', { name: 'Edit Slug' }).nth(1).click();
    await page.getByRole('textbox', { name: 'French' }).fill('salut');
    await page.getByRole('button', { name: 'Done' }).click();

    // Only the edited locale is updated
    await expect.poll(() => draft.currentSlugs).toEqual({ en: 'Hello', fr: 'salut' });
  });

  test('leaves out a locale the entry has no file for', async () => {
    const { draft } = await renderForm(
      {
        isNew: false,
        originalSlugs: { en: 'hello', fr: undefined },
        currentSlugs: { en: 'hello', fr: undefined },
      },
      { i18nConfig: i18n },
    );

    expect(page.getByRole('textbox').elements()).toHaveLength(1);

    await page.getByRole('button', { name: 'Edit Slug' }).click();
    await page.getByRole('textbox', { name: 'English' }).fill('Hello-World');
    await page.getByRole('button', { name: 'Done' }).click();

    await expect.poll(() => draft.currentSlugs).toEqual({ en: 'hello-world', fr: undefined });
  });

  test('renames the folder of an entry stored as an index file', async () => {
    const { draft } = await renderForm(
      {
        isNew: false,
        originalEntry: createMockEntry({ slug: 'docs/guides/index', folder: 'content/pages' }),
        currentPath: 'docs/guides',
        currentSlugs: { _default: 'docs/guides/index' },
      },
      { collectionName: 'pages' },
    );

    await expect.element(page.getByRole('textbox', { name: 'Folder' })).toHaveTextContent('guides');

    await page.getByRole('button', { name: 'Rename Folder' }).click();

    const input = page.getByRole('textbox', { name: 'Folder' });
    const done = page.getByRole('button', { name: 'Done' });

    // A sibling folder’s name is taken
    await input.fill('api');
    await expect
      .element(page.getByText('A folder with this name already exists here.'))
      .toBeInTheDocument();
    await expect.element(done).toBeDisabled();

    await input.fill('User Guides');
    await expect.element(done).toBeEnabled();
    await done.click();

    await expect.poll(() => draft.currentPath).toBe('docs/user-guides');
    await expect
      .element(page.getByRole('textbox', { name: 'Folder' }))
      .toHaveTextContent('user-guides');
  });

  test('renames the localized folders of an entry stored as an index file', async () => {
    const { draft } = await renderForm(
      {
        isNew: false,
        originalEntry: createMockEntry({ slug: 'docs/guides/index', folder: 'content/guides' }),
        currentPath: 'docs/guides',
        currentSlugs: { en: 'docs/guides/index', fr: 'docs/guides-fr/index' },
        currentLocales: { en: true, fr: true },
      },
      { collectionName: 'guides', i18nConfig: i18n },
    );

    expect(
      page
        .getByRole('heading', { level: 4 })
        .elements()
        .map((el) => el.textContent),
    ).toEqual(['English', 'French']);
    await expect
      .element(page.getByRole('textbox', { name: 'English' }))
      .toHaveTextContent('guides');
    await expect
      .element(page.getByRole('textbox', { name: 'French' }))
      .toHaveTextContent('guides-fr');

    // The folders next to the entry’s own are taken in each locale
    await page.getByRole('button', { name: 'Rename Folder' }).nth(0).click();
    await page.getByRole('textbox', { name: 'English' }).fill('api');
    await expect.element(page.getByRole('textbox', { name: 'English' })).toBeInvalid();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Rename Folder' }).nth(1).click();
    await page.getByRole('textbox', { name: 'French' }).fill('api-fr');
    await expect.element(page.getByRole('textbox', { name: 'French' })).toBeInvalid();
    await expect.element(page.getByRole('button', { name: 'Done' })).toBeDisabled();

    await page.getByRole('textbox', { name: 'French' }).fill('Manuels');
    await page.getByRole('button', { name: 'Done' }).click();

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
        .getByRole('heading', { level: 4 })
        .elements()
        .map((el) => el.textContent);

    const { unmount } = await renderForm(
      { currentSlugs: { en: 'hello', fr_CA: 'bonjour' } },
      { i18nConfig },
    );

    await expect.poll(getHeadings).toEqual(['English', 'fr_CA']);
    unmount();

    await renderForm(
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
