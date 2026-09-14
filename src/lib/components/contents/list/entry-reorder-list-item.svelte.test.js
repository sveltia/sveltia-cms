import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection } from '$lib/services/contents/collection';
import { env } from '$lib/services/user/env.svelte';
import { createMockEntry, initTestConfig } from '$lib/test/config';

import EntryReorderListItem from './entry-reorder-list-item.svelte';

describe('EntryReorderListItem', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('shows the entry with the move buttons', async () => {
    env.isSmallScreen = false;

    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();

    const { container } = await render(EntryReorderListItem, {
      collection: /** @type {any} */ (getCollection('posts')),
      entry: createMockEntry({ slug: 'a', content: { _default: { title: 'Hello' } } }),
      viewType: 'list',
      canMoveUp: true,
      canMoveDown: false,
      onMoveUp,
      onMoveDown,
    });

    expect(container.querySelector('.title')).toHaveTextContent('Hello');
    // No selection checkbox while reordering
    expect(container.querySelector('.checkbox')).toBeNull();

    await page.getByRole('button', { name: 'Move Up' }).click();
    expect(onMoveUp).toHaveBeenCalledOnce();
    await expect
      .element(page.getByRole('button', { name: 'Move Down' }))
      .toHaveAttribute('aria-disabled', 'true');
  });
});
