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
      ],
    });
    setEntries([
      tagEntry,
      createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello', tag: 'svelte' } } }),
      createMockEntry({ slug: 'again', content: { _default: { title: 'Again', tag: 'svelte' } } }),
      createMockEntry({ slug: 'world', content: { _default: { title: 'World', tag: 'react' } } }),
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
    const group = panel.getByRole('group');

    await expect.element(group.getByRole('heading', { level: 4 })).toHaveTextContent('Posts');
    expect(
      group
        .getByRole('button')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Hello', 'Again']);

    await group.getByRole('button', { name: 'Hello' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/hello');
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
