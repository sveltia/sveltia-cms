import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import BacklinksPanel from './backlinks-panel.svelte';

const tagEntry = createMockEntry({
  slug: 'svelte',
  folder: 'content/tags',
  content: { _default: { name: 'Svelte' } },
});

describe('BacklinksPanel', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'tags',
          label: 'Tags',
          folder: 'content/tags',
          fields: [{ name: 'name', widget: 'string' }],
        },
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [
            { name: 'title', widget: 'string' },
            {
              name: 'tag',
              widget: 'relation',
              collection: 'tags',
              value_field: '{{slug}}',
              search_fields: ['name'],
            },
          ],
        },
        {
          name: 'settings',
          label: 'Settings',
          files: [
            {
              name: 'general',
              label: 'General Settings',
              file: 'content/general.yml',
              fields: [
                {
                  name: 'featured_tag',
                  widget: 'relation',
                  collection: 'tags',
                  value_field: '{{slug}}',
                  search_fields: ['name'],
                },
              ],
            },
          ],
        },
      ],
    });
    setEntries([
      tagEntry,
      createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello', tag: 'svelte' } } }),
      createMockEntry({ slug: 'again', content: { _default: { title: 'Again', tag: 'svelte' } } }),
      createMockEntry({ slug: 'world', content: { _default: { title: 'World', tag: 'react' } } }),
      createMockEntry({
        slug: 'general',
        folder: 'content',
        extension: 'yml',
        content: { _default: { featured_tag: 'svelte' } },
        entry: { subPath: 'content/general.yml' },
      }),
    ]);
  });

  test('lists the entries referencing the entry, grouped by collection', async () => {
    window.location.hash = '#/collections/tags/entries/svelte';

    await renderWithDraft(BacklinksPanel, {
      draft: createMockDraft({
        collectionName: 'tags',
        draft: { isNew: false, originalEntry: tagEntry },
      }),
    });

    const panel = page.getByRole('group', { name: 'Backlinks' });
    const group = panel.getByRole('group', { name: 'Posts' });

    await expect.element(group.getByRole('heading', { level: 4 })).toHaveTextContent('Posts');
    // The entries are sorted by summary
    expect(
      group
        .getByRole('button')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Again', 'Hello']);

    await group.getByRole('button', { name: 'Hello' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/hello');
  });

  test('opens a collection file by its name', async () => {
    window.location.hash = '#/collections/tags/entries/svelte';

    await renderWithDraft(BacklinksPanel, {
      draft: createMockDraft({
        collectionName: 'tags',
        draft: { isNew: false, originalEntry: tagEntry },
      }),
    });

    const group = page.getByRole('group', { name: 'Settings' });

    await group.getByRole('button', { name: 'General Settings' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/settings/entries/general');
  });

  test('reports an entry without backlinks', async () => {
    await renderWithDraft(BacklinksPanel, {
      draft: createMockDraft({ collectionName: 'tags' }),
    });

    await expect
      .element(page.getByText('No entries are referencing this entry.'))
      .toBeInTheDocument();
  });
});
