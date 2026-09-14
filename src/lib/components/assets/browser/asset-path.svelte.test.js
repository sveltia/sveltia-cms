import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import AssetPath from './asset-path.svelte';

describe('AssetPath', () => {
  test('shows the folders and the file name with break opportunities', async () => {
    const { container } = await render(AssetPath, { path: '/static/my-images/photo_1.png/' });
    const name = /** @type {HTMLElement} */ (container.querySelector('.name'));

    expect(name).toHaveAttribute('aria-hidden', 'true');
    expect(name.textContent?.replace(/\s+/g, ' ').trim()).toBe('static/my-images/photo_1.png');
    expect(name.querySelector('strong')?.innerHTML).toBe('photo_<wbr>1.<wbr>png');
    expect(name.querySelectorAll('wbr')).toHaveLength(3);
  });

  test('falls back to the caption', async () => {
    const { container } = await render(AssetPath, { caption: 'Untitled' });

    expect(container.querySelector('strong')).toHaveTextContent('Untitled');
  });

  test('renders nothing without a path or caption', async () => {
    const { container } = await render(AssetPath, {});

    expect(container.querySelector('.name')).toBeNull();
  });

  test('renders the extra content', async () => {
    const children = createRawSnippet(() => ({
      /**
       * Render the content.
       * @returns {string} HTML.
       */
      render: () => '<em>credit</em>',
    }));

    const { container } = await render(AssetPath, { path: 'photo.png', children });

    expect(container.querySelector('.name em')).toHaveTextContent('credit');
  });
});
