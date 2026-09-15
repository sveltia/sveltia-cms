import { createRawSnippet, flushSync } from 'svelte';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { mainAreaTitle } from '$lib/services/app/navigation';

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
    // The area is the page’s main landmark, and names the document
    await expect.element(page.getByRole('main', { name: 'Main' })).toBeInTheDocument();
    expect(mainAreaTitle.current).toBe('Main');
    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Primary',
      'Secondary',
      'Content',
      'Sidebar',
    ]);
    expect(container.querySelector('.main-inner-main')).toHaveTextContent('Secondary Content');
  });

  test('lays out nothing without content', async () => {
    const { container } = await render(PageContainerMainArea, {});

    expect(container.querySelectorAll('p')).toHaveLength(0);
    // An unnamed area leaves the document with the app name alone
    expect(mainAreaTitle.current).toBe('');
  });

  test('hands the title over to the next area during a page transition', async () => {
    const outgoing = await render(PageContainerMainArea, { 'aria-label': 'Outgoing' });

    expect(mainAreaTitle.current).toBe('Outgoing');

    // The next page’s area can be mounted before the previous one is destroyed
    await render(PageContainerMainArea, { 'aria-label': 'Incoming' });
    expect(mainAreaTitle.current).toBe('Incoming');

    outgoing.unmount();
    flushSync();
    expect(mainAreaTitle.current).toBe('Incoming');
  });
});
