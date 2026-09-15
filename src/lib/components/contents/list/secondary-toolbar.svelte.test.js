import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { setReorderMode } from '$lib/services/contents/collection/view';
import { currentView } from '$lib/services/contents/collection/view/settings';
import { env } from '$lib/services/user/env.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import SecondaryToolbar from './secondary-toolbar.svelte';

describe('SecondaryToolbar', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          media_folder: 'static/posts',
          public_folder: '/posts',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'image', widget: 'image' },
            { name: 'draft', widget: 'boolean' },
          ],
          view_filters: [{ label: 'Drafts', field: 'draft', pattern: true }],
          view_groups: [{ label: 'Draft', field: 'draft' }],
        },
        {
          name: 'settings',
          files: [{ name: 'general', file: 'data/general.yml', fields: [{ name: 'x' }] }],
        },
      ],
    });
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    env.isLargeScreen = true;
    forkedRepository.current = undefined;
    setReorderMode(false);
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A', draft: true } } }),
      createMockEntry({ slug: 'b', content: { _default: { title: 'B', draft: false } } }),
    ]);
    selectedCollection.current = getCollection('posts');
  });

  test('offers the list controls for an entry collection', async () => {
    await render(SecondaryToolbar, {});

    const toolbar = page.getByRole('toolbar', { name: 'Entry List' });

    await expect.element(toolbar.getByRole('checkbox', { name: 'Select All' })).toBeVisible();
    await expect.element(toolbar.getByRole('button', { name: 'Sort' })).toBeVisible();
    await expect.element(toolbar.getByRole('button', { name: 'Filter' })).toBeVisible();
    await expect.element(toolbar.getByRole('button', { name: 'Group' })).toBeVisible();
    await expect.element(toolbar.getByRole('radiogroup', { name: 'Switch View' })).toBeVisible();

    const media = toolbar.getByRole('button', { name: 'Show Assets' });

    // `aria-expanded` and `aria-controls` are only set once the pane is shown
    await expect.element(media).toHaveAttribute('aria-pressed', 'false');
    await expect.element(media).not.toHaveAttribute('aria-controls');
    await media.click();
    await expect.poll(() => currentView.current.showMedia).toBe(true);
    await expect
      .element(toolbar.getByRole('button', { name: 'Hide Assets' }))
      .toHaveAttribute('aria-controls', 'collection-assets');
  });

  test('leaves out the selector on a small screen', async () => {
    env.isSmallScreen = true;

    await render(SecondaryToolbar, {});

    expect(page.getByRole('checkbox').elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Show Assets' }).elements()).toHaveLength(0);
  });

  test('is hidden for a file collection, and while reordering', async () => {
    selectedCollection.current = getCollection('settings');

    const files = await render(SecondaryToolbar, {});

    expect(files.container.querySelector('[role="toolbar"]')).toBeNull();
    await files.unmount();

    selectedCollection.current = getCollection('posts');

    const reorder = await render(SecondaryToolbar, {});

    await expect.element(page.getByRole('toolbar')).toBeVisible();
    setReorderMode(true);
    await expect.poll(() => reorder.container.querySelector('[role="toolbar"]')).toBeNull();
  });
});
