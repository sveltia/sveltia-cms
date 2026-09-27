import { flushSync } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import { TEST_IMAGE_URL } from '$lib/test/config';

import EntryThumbnail from './entry-thumbnail.svelte';

const { mockLoadEntryThumbnail, mockRelease } = vi.hoisted(() => ({
  mockLoadEntryThumbnail: vi.fn(),
  mockRelease: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/assets', () => ({
  loadEntryThumbnail: mockLoadEntryThumbnail,
}));

describe('EntryThumbnail', () => {
  const collection = /** @type {any} */ ({ name: 'posts' });
  const entry = /** @type {any} */ ({ id: 'a' });

  test('shows the thumbnail, and releases it when the entry changes or is removed', async () => {
    mockLoadEntryThumbnail.mockImplementation((_collection, _entry, onLoad) => {
      onLoad(TEST_IMAGE_URL);

      return () => {
        mockRelease(_entry.id);
        onLoad(undefined);
      };
    });

    const props = $state({ collection, entry, variant: /** @type {'icon' | 'tile'} */ ('tile') });
    const { container, unmount } = await render(EntryThumbnail, props);

    await expect
      .poll(() => container.querySelector('img')?.getAttribute('src'))
      .toBe(TEST_IMAGE_URL);
    expect(container.querySelector('.preview')).toHaveClass('tile');
    expect(mockLoadEntryThumbnail).toHaveBeenCalledWith(collection, entry, expect.any(Function));

    props.entry = /** @type {any} */ ({ id: 'b' });
    flushSync();
    expect(mockRelease).toHaveBeenCalledExactlyOnceWith('a');
    expect(mockLoadEntryThumbnail).toHaveBeenLastCalledWith(
      collection,
      props.entry,
      expect.any(Function),
    );

    unmount();
    expect(mockRelease).toHaveBeenLastCalledWith('b');
  });

  test('renders nothing for an entry without a thumbnail', async () => {
    mockLoadEntryThumbnail.mockImplementation(() => () => {});

    const { container } = await render(EntryThumbnail, { collection, entry, variant: 'icon' });

    expect(container.querySelector('.preview')).toBeNull();
  });
});
