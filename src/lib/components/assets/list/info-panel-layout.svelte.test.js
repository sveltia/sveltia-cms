import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import InfoPanelLayout from './info-panel-layout.svelte';

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

describe('InfoPanelLayout', () => {
  test('lays out the preview above the details', async () => {
    const { container } = await render(InfoPanelLayout, {
      preview: snippet('Preview'),
      children: snippet('Details'),
    });

    expect(container.querySelector('.preview')).toHaveTextContent('Preview');
    expect(container.querySelector('.detail')).toHaveTextContent('Preview Details');
  });

  test('leaves out the preview area when there is none', async () => {
    const { container } = await render(InfoPanelLayout, { children: snippet('Details') });

    expect(container.querySelector('.preview')).toBeNull();
  });
});
