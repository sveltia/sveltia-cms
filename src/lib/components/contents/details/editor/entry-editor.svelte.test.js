import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { getCollection } from '$lib/services/contents/collection';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import EntryEditor from './entry-editor.svelte';

const fields = [
  { name: 'title', label: 'Title', widget: 'string' },
  { name: 'body', label: 'Body', widget: 'text' },
];

describe('EntryEditor', () => {
  test('renders an editor for each field', async () => {
    const draft = createMockDraft({
      fields,
      values: { _default: { title: 'Hello', body: 'World' } },
    });

    await renderWithDraft(EntryEditor, { draft, props: { locale: '_default' } });

    const groups = page.getByRole('group');

    // The fields are rendered once visible
    await expect
      .poll(() => groups.elements().map((el) => el.getAttribute('data-key-path')))
      .toEqual(['title', 'body']);
    await expect.element(groups.nth(0).getByRole('textbox')).toHaveValue('Hello');
    await expect.element(groups.nth(1).getByRole('textbox')).toHaveValue('World');
    expect(page.getByRole('textbox', { name: 'Slug' }).elements()).toHaveLength(0);
  });

  test('leaves the slug editor to the Slug panel', async () => {
    const draft = createMockDraft({
      fields,
      values: { _default: { title: 'Hello', body: '' } },
      draft: { slugEditor: { _default: true }, currentSlugs: { _default: '' } },
    });

    await renderWithDraft(EntryEditor, { draft, props: { locale: '_default' } });

    await expect
      .poll(() =>
        page
          .getByRole('group')
          .elements()
          .map((el) => el.getAttribute('data-key-path')),
      )
      .toEqual(['title', 'body']);
    expect(page.getByRole('textbox', { name: 'Slug' }).elements()).toHaveLength(0);
  });

  test('adds the path editor for a nested collection', async () => {
    await initTestConfig({
      collections: [
        {
          name: 'pages',
          label: 'Pages',
          folder: 'content/pages',
          nested: { depth: 3 },
          meta: { path: { widget: 'string', index_file: 'index' } },
          fields,
        },
      ],
    });
    setEntries([
      createMockEntry({
        slug: 'docs/index',
        folder: 'content/pages',
        content: { _default: { title: 'Documentation' } },
      }),
    ]);

    const draft = createMockDraft({
      collectionName: 'pages',
      fields,
      values: { _default: { title: 'Hello', body: '' } },
      draft: { collection: getCollection('pages'), currentPath: 'docs' },
    });

    await renderWithDraft(EntryEditor, { draft, props: { locale: '_default' } });

    await expect.element(page.getByRole('button', { name: 'Parent Folder' })).toBeVisible();
  });

  test('renders nothing without a draft', async () => {
    const { container } = await renderWithDraft(EntryEditor, {
      draft: /** @type {any} */ (null),
      props: { locale: '_default' },
    });

    expect(container.querySelectorAll('[role="group"]')).toHaveLength(0);
  });
});
