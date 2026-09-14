import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import PageContainerMainArea from './page-container-main-area.svelte';

/**
 * Build a snippet rendering the given text.
 * @param {string} text Text.
 * @returns {import('svelte').Snippet} Snippet.
 */
const snippet = (text) =>
  createRawSnippet(() => ({
    /**
     * Render the content.
     * @returns {string} HTML.
     */
    render: () => `<p>${text}</p>`,
  }));

describe('PageContainerMainArea', () => {
  test('lays out the toolbars, content and sidebar', async () => {
    const { container } = await render(PageContainerMainArea, {
      'aria-label': 'Main',
      primaryToolbar: snippet('Primary'),
      secondaryToolbar: snippet('Secondary'),
      mainContent: snippet('Content'),
      secondarySidebar: snippet('Sidebar'),
    });

    const wrapper = container.querySelector('.wrapper');

    expect(wrapper).toHaveAttribute('aria-label', 'Main');
    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Primary',
      'Secondary',
      'Content',
      'Sidebar',
    ]);
    expect(container.querySelector('.main-inner-main')).toHaveTextContent('Secondary Content');
  });

  test('lays out nothing without content', async () => {
    const { container } = await render(PageContainerMainArea, { 'aria-label': 'Main' });

    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
