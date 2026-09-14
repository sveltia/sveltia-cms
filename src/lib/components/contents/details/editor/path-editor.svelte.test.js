import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { getCollection } from '$lib/services/contents/collection';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import PathEditor from './path-editor.svelte';

/**
 * @import { Collection } from '$lib/types/public';
 */

/** @type {Collection} */
const pagesCollection = {
  name: 'pages',
  label: 'Pages',
  folder: 'content/pages',
  nested: { depth: 3 },
  meta: { path: { widget: 'string', index_file: 'index' } },
  fields: [{ name: 'title', widget: 'string' }],
};

/**
 * Render the editor.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @param {string} [locale] Locale.
 * @returns {Promise<any>} Draft.
 */
const renderEditor = async (draftProps = {}, locale = '_default') => {
  const draft = createMockDraft({
    collectionName: 'pages',
    draft: {
      collection: getCollection('pages'),
      // The folder the entry is stored in
      currentPath: 'docs/guides',
      ...draftProps,
    },
  });

  await renderWithDraft(PathEditor, { draft, props: { locale } });

  return draft;
};

/**
 * Get the label of a tree item.
 * @param {Element} element Tree item.
 * @returns {string | undefined} Label.
 */
const getLabel = (element) => element.querySelector('.label')?.textContent?.trim();

/**
 * Open the folder picker.
 * @returns {Promise<void>}
 */
const openPicker = async () => {
  await page.getByRole('button', { name: 'Parent Folder' }).click();
  // A Sveltia UI tree starts handling clicks 100 ms after it’s opened
  await sleep(150);
};

/** @type {Collection} */
const localizedCollection = {
  name: 'localized',
  label: 'Localized',
  folder: 'content/localized',
  nested: { depth: 3 },
  i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
  meta: { path: { widget: 'string', index_file: 'index' } },
  fields: [{ name: 'title', widget: 'string' }],
};

/** @type {Collection} */
const docsCollection = {
  name: 'docs',
  label: 'Docs',
  folder: 'content/docs',
  nested: { depth: 3, subfolders: false },
  meta: { path: { widget: 'string' } },
  fields: [{ name: 'title', widget: 'string' }],
};

/** @type {Collection} */
const emptyPagesCollection = { ...pagesCollection, name: 'empty-pages', folder: 'content/empty' };
/** @type {Collection} */
const emptyDocsCollection = { ...docsCollection, name: 'empty-docs', folder: 'content/empty' };

describe('PathEditor', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        pagesCollection,
        docsCollection,
        localizedCollection,
        emptyPagesCollection,
        emptyDocsCollection,
      ],
    });
    setEntries([
      createMockEntry({
        slug: 'docs/index',
        folder: 'content/pages',
        content: { _default: { title: 'Documentation' } },
      }),
      createMockEntry({
        slug: 'docs/guides/index',
        folder: 'content/pages',
        content: { _default: { title: 'Guides' } },
      }),
      createMockEntry({ slug: 'docs/guides/start', folder: 'content/pages' }),
      createMockEntry({
        slug: 'about/index',
        folder: 'content/pages',
        content: { _default: { title: 'About Us' } },
      }),
      createMockEntry({ slug: 'guides/start', folder: 'content/docs' }),
      createMockEntry({ slug: 'guides/advanced/tips', folder: 'content/docs' }),
      createMockEntry({
        slug: 'docs/index',
        folder: 'content/localized',
        content: { en: { title: 'Documentation' }, fr: { title: 'Documentation' } },
      }),
      createMockEntry({
        slug: 'docs/guides/index',
        folder: 'content/localized',
        content: { en: { title: 'Guides' }, fr: { title: 'Guides' } },
      }),
    ]);
  });

  beforeEach(() => {
    unpublishedEntries.current = [];
  });

  test('offers the folders in a tree, opened down to the current one', async () => {
    const draft = await renderEditor();
    const button = page.getByRole('button', { name: 'Parent Folder' });

    await expect.element(button).toHaveTextContent('folder Guides expand_more');
    await expect.element(button).toHaveAttribute('aria-description', 'docs/guides');
    await expect.element(button).toHaveAttribute('aria-haspopup', 'tree');

    await openPicker();

    const tree = page.getByRole('tree', { name: 'Parent Folder' });

    // The index entries name the folders
    expect(tree.getByRole('treeitem').elements().map(getLabel)).toEqual([
      'Pages',
      'About Us',
      'Documentation',
      'Guides',
    ]);
    await expect
      .element(tree.getByRole('treeitem', { name: 'Guides' }))
      .toHaveAttribute('aria-selected', 'true');
    await expect
      .element(tree.getByRole('treeitem', { name: 'Documentation' }))
      .toHaveAttribute('aria-expanded', 'true');

    await tree.getByRole('treeitem', { name: 'About Us' }).getByText('About Us').click();
    await expect.poll(() => draft.currentPath).toBe('about');
    // The popup closes itself once a folder is chosen
    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await expect.element(button).toHaveTextContent('folder About Us expand_more');
  });

  test('offers the top level of the collection', async () => {
    const draft = await renderEditor();
    const button = page.getByRole('button', { name: 'Parent Folder' });

    await openPicker();
    await page.getByRole('treeitem', { name: 'Pages' }).getByText('Pages').click();
    await expect.poll(() => draft.currentPath).toBe('');
    await expect.element(button).toHaveTextContent('bookmark_manager Pages expand_more');
    await expect.element(button).not.toHaveAttribute('aria-description');
  });

  test('keeps an existing entry out of its own subfolders', async () => {
    // The entry’s own folder is `docs`, so the parent is the root
    const draft = await renderEditor({
      isNew: false,
      originalEntry: createMockEntry({ slug: 'docs/index', folder: 'content/pages' }),
      currentPath: 'docs',
    });

    const button = page.getByRole('button', { name: 'Parent Folder' });

    await expect.element(button).toHaveTextContent('bookmark_manager Pages expand_more');
    await openPicker();

    expect(page.getByRole('tree').getByRole('treeitem').elements().map(getLabel)).toEqual([
      'Pages',
      'About Us',
    ]);

    // The entry is moved along with its folder
    await page.getByRole('treeitem', { name: 'About Us' }).getByText('About Us').click();
    await expect.poll(() => draft.currentPath).toBe('about/docs');
  });

  test('counts the unpublished entries in', async () => {
    unpublishedEntries.current = [
      /** @type {any} */ ({
        ...createMockEntry({
          slug: 'blog/index',
          folder: 'content/pages',
          content: { _default: { title: 'Blog' } },
        }),
        workflow: { status: 'draft', collectionName: 'pages' },
      }),
    ];

    await renderEditor();
    await openPicker();

    await expect.element(page.getByRole('treeitem', { name: 'Blog' })).toBeInTheDocument();
  });

  test('shows the validation errors', async () => {
    const draft = await renderEditor({
      validities: { _default: { _path: { valid: false, customError: true } } },
    });

    await expect
      .element(page.getByRole('button', { name: 'Parent Folder' }))
      .toHaveAttribute('aria-invalid', 'true');
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error The entry cannot be moved into one of its own subfolders.');

    draft.validities._default._path = { valid: false, duplicateError: true };
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error This path is used for another entry.');

    draft.validities._default._path = { valid: false, patternMismatch: true };
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error The path cannot contain relative segments such as “..”.');
  });

  test('creates a new folder when the entries can’t have subfolders', async () => {
    const draft = createMockDraft({
      collectionName: 'docs',
      draft: { collection: getCollection('docs'), currentPath: 'guides' },
    });

    await renderWithDraft(PathEditor, { draft, props: { locale: '_default' } });

    // The folders are named after their paths, as there’s no index entry
    await expect
      .element(page.getByRole('button', { name: 'Parent Folder' }))
      .toHaveTextContent('folder guides expand_more');

    await page.getByRole('button', { name: 'New Folder' }).click();

    const dialog = page.getByRole('dialog', { name: 'New Folder' });
    const input = dialog.getByRole('textbox', { name: 'Folder Name' });
    const create = dialog.getByRole('button', { name: 'Create' });

    await expect
      .element(dialog.getByText('The new folder will be created in “\u2068guides\u2069”.'))
      .toBeInTheDocument();
    await expect.element(create).toBeDisabled();

    // A sibling folder’s name is taken
    await input.fill('advanced');
    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent('error A folder with this name already exists here.');
    await expect.element(create).toBeDisabled();

    await input.fill('a/b');
    await expect
      .element(dialog.getByRole('alert'))
      .toHaveTextContent(
        'error The folder name cannot contain slashes or start with a dot, and must include letters or numbers.',
      );

    await input.fill('API Reference');
    await expect.element(create).toBeEnabled();
    await create.click();

    // The folder name is slugified
    await expect.poll(() => draft.currentPath).toBe('guides/api-reference');
    await expect
      .element(page.getByRole('button', { name: 'Parent Folder' }))
      .toHaveTextContent('folder api-reference expand_more');
  });

  test('describes the folder in the locale, where it can’t be changed', async () => {
    const draft = createMockDraft({
      collectionName: 'localized',
      i18n: { i18nEnabled: true, defaultLocale: 'en', allLocales: ['en', 'fr'] },
      values: { en: {}, fr: {} },
      draft: { collection: getCollection('localized'), currentPath: 'docs/guides' },
    });

    await renderWithDraft(PathEditor, { draft, props: { locale: 'fr' } });

    const button = page.getByRole('button', { name: 'Parent Folder' });

    await expect.element(button).toBeDisabled();
    await expect.element(button).toHaveAttribute('aria-description', 'docs/guides');
  });

  test('renders nothing without a collection', async () => {
    const draft = createMockDraft({ collectionName: 'pages', draft: { collection: undefined } });

    const { container } = await renderWithDraft(PathEditor, {
      draft,
      props: { locale: '_default' },
    });

    expect(container.children).toHaveLength(0);
  });

  test('shows a folder that isn’t in the tree by its path', async () => {
    await renderEditor({ currentPath: 'nowhere/else' });

    const button = page.getByRole('button', { name: 'Parent Folder' });

    await expect.element(button).toHaveTextContent('folder nowhere/else expand_more');
    await expect.element(button).toHaveAttribute('aria-description', 'nowhere/else');
  });

  test('offers every folder to the collection’s own index file', async () => {
    const draft = await renderEditor({
      isNew: false,
      originalEntry: createMockEntry({ slug: 'index', folder: 'content/pages' }),
      currentPath: '',
    });

    await expect
      .element(page.getByRole('button', { name: 'Parent Folder' }))
      .toHaveTextContent('bookmark_manager Pages expand_more');
    await openPicker();

    expect(page.getByRole('tree').getByRole('treeitem').elements().map(getLabel)).toEqual([
      'Pages',
      'About Us',
      'Documentation',
    ]);

    // The file has no folder of its own to take along
    await page.getByRole('treeitem', { name: 'About Us' }).getByText('About Us').click();
    await expect.poll(() => draft.currentPath).toBe('about');
  });

  test('only offers to create a folder while the collection has none', async () => {
    const draft = createMockDraft({
      collectionName: 'empty-docs',
      draft: { collection: getCollection('empty-docs'), currentPath: '' },
    });

    await renderWithDraft(PathEditor, { draft, props: { locale: '_default' } });

    await expect.element(page.getByRole('button', { name: 'Parent Folder' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'New Folder' })).toBeEnabled();
  });

  test('renders nothing for a nested collection without entries', async () => {
    const draft = createMockDraft({
      collectionName: 'empty-pages',
      draft: { collection: getCollection('empty-pages'), currentPath: '' },
    });

    const { container } = await renderWithDraft(PathEditor, {
      draft,
      props: { locale: '_default' },
    });

    expect(container.children).toHaveLength(0);
  });

  test('renders nothing for a collection without folders', async () => {
    const draft = createMockDraft({ collectionName: 'pages' });

    const { container } = await renderWithDraft(PathEditor, {
      draft,
      props: { locale: '_default' },
    });

    expect(container.children).toHaveLength(0);
  });
});
