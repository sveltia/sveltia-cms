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
      };
    });

    const props = $state({ collection, entry, variant: /** @type {'icon' | 'tile'} */ ('tile') });
    const { container, unmount } = await render(EntryThumbnail, props);

    await expect
      .poll(() => container.querySelector('img')?.getAttribute('src'))
      .toBe(TEST_IMAGE_URL);
    expect(container.querySelector('.preview')).toHaveClass('tile');
    expect(mockLoadEntryThumbnail).toHaveBeenCalledWith(collection, entry, expect.any(Function));

    // The thumbnail of the previous entry is no longer shown, and the new one is loaded once it has
    // stayed in view
    props.entry = /** @type {any} */ ({ id: 'b' });
    flushSync();
    expect(mockRelease).toHaveBeenCalledExactlyOnceWith('a');
    expect(container.querySelector('img')).toBeNull();
    await expect.poll(() => mockLoadEntryThumbnail.mock.lastCall?.[1]).toBe(props.entry);
    await expect
      .poll(() => container.querySelector('img')?.getAttribute('src'))
      .toBe(TEST_IMAGE_URL);

    unmount();
    expect(mockRelease).toHaveBeenLastCalledWith('b');
  });

  test('only loads the thumbnail once it has stayed in view for a moment', async () => {
    mockLoadEntryThumbnail.mockImplementation(() => () => {});

    const { container } = await render(EntryThumbnail, { collection, entry, variant: 'icon' });
    const spacer = document.createElement('div');

    // Push the thumbnail well below the viewport
    spacer.style.height = '5000px';
    container.before(spacer);
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    expect(mockLoadEntryThumbnail).not.toHaveBeenCalled();

    // Passing through the viewport doesn’t count
    spacer.style.height = '0px';
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    spacer.style.height = '5000px';
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    expect(mockLoadEntryThumbnail).not.toHaveBeenCalled();

    spacer.style.height = '0px';
    await expect.poll(() => mockLoadEntryThumbnail).toHaveBeenCalledOnce();
    expect(container.querySelector('.preview')).toBeNull();
    spacer.remove();
  });

  test('cancels the wait when the thumbnail is removed before it has loaded', async () => {
    mockLoadEntryThumbnail.mockImplementation(() => () => {});

    const { unmount } = await render(EntryThumbnail, { collection, entry, variant: 'icon' });

    unmount();
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    expect(mockLoadEntryThumbnail).not.toHaveBeenCalled();
  });

  test('renders nothing for an entry without a thumbnail', async () => {
    mockLoadEntryThumbnail.mockImplementation(() => () => {});

    const { container } = await render(EntryThumbnail, { collection, entry, variant: 'icon' });

    expect(container.querySelector('.preview')).toBeNull();
  });
});
