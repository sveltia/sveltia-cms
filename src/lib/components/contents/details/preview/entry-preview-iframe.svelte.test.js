import { createElement } from 'react';
import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import EntryPreviewIframe from './entry-preview-iframe.svelte';

vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn((name) => `https://unpkg.com/${name}`),
  loadModule: vi.fn(),
  getChunkURLs: vi.fn(() => []),
  loadChunk: vi.fn(() => import('$lib/chunks/react-dom.js')),
}));

const children = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<p class="preview-content">Hello</p>',
}));

/**
 * Get the document in the frame.
 * @param {HTMLElement} container Container.
 * @returns {Document | null | undefined} Document.
 */
const getDocument = (container) =>
  /** @type {HTMLIFrameElement | null} */ (container.querySelector('iframe.preview'))
    ?.contentDocument;

describe('EntryPreviewIframe', () => {
  test('renders the content in a sandboxed frame with the styles', async () => {
    const { container } = await renderWithDraft(EntryPreviewIframe, {
      draft: createMockDraft(),
      props: {
        locale: 'fr',
        styleURLs: ['https://example.com/a.css', 'https://example.com/b.css'],
        children,
      },
    });

    const iframe = /** @type {HTMLIFrameElement} */ (container.querySelector('iframe.preview'));

    expect(iframe.title).toBe('Content Preview');
    expect(iframe.sandbox.toString()).toBe(
      'allow-same-origin allow-scripts allow-popups allow-forms',
    );

    await expect
      .poll(() => getDocument(container)?.querySelector('.preview-content')?.textContent)
      .toBe('Hello');

    const doc = /** @type {Document} */ (getDocument(container));

    expect(doc.documentElement.lang).toBe('fr');
    expect(doc.querySelector('base')?.getAttribute('href')).toBe(window.location.origin);
    expect(
      [...doc.querySelectorAll('link[rel="stylesheet"]')].map((el) => el.getAttribute('href')),
    ).toEqual(['https://example.com/a.css', 'https://example.com/b.css']);
  });

  test('renders a React component, updating it with the props', async () => {
    /**
     * A component.
     * @param {any} props Props.
     * @returns {any} React element.
     */
    const Greeting = ({ name, document }) =>
      createElement('p', { className: 'greeting' }, `Hello, ${name} (${document.title})`);

    const props = $state({
      locale: 'en',
      styleURLs: [],
      reactComponent: Greeting,
      reactProps: { name: 'Melvin' },
    });

    const { container } = await renderWithDraft(EntryPreviewIframe, {
      draft: createMockDraft(),
      props,
    });

    await expect
      .poll(() => getDocument(container)?.querySelector('.greeting')?.textContent)
      .toBe('Hello, Melvin ()');

    props.reactProps = { name: 'Elsie' };
    await expect
      .poll(() => getDocument(container)?.querySelector('.greeting')?.textContent)
      .toBe('Hello, Elsie ()');
  });
});
