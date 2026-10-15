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
    expect(doc.documentElement.dir).toBe('ltr');
    expect(doc.querySelector('base')?.getAttribute('href')).toBe(window.location.origin);
    expect(
      [...doc.querySelectorAll('link[rel="stylesheet"]')].map((el) => el.getAttribute('href')),
    ).toEqual(['https://example.com/a.css', 'https://example.com/b.css']);
  });

  test('reports the frame once its content has been mounted', async () => {
    const onLoad = vi.fn();

    const { container } = await renderWithDraft(EntryPreviewIframe, {
      draft: createMockDraft(),
      props: { locale: 'en', styleURLs: [], children, onLoad },
    });

    await expect.poll(() => onLoad.mock.calls.length).toBe(1);
    expect(onLoad).toHaveBeenCalledWith(container.querySelector('iframe.preview'));
    expect(getDocument(container)?.querySelector('.preview-content')?.textContent).toBe('Hello');
  });

  test('sets the language and direction of the locale, and updates them with the locale', async () => {
    const props = $state({ locale: 'ar', styleURLs: [], children });

    const { container } = await renderWithDraft(EntryPreviewIframe, {
      draft: createMockDraft(),
      props,
    });

    await expect
      .poll(() => getDocument(container)?.querySelector('.preview-content')?.textContent)
      .toBe('Hello');

    const root = /** @type {Document} */ (getDocument(container)).documentElement;

    expect(root.lang).toBe('ar');
    expect(root.dir).toBe('rtl');

    // The pane switches to another locale without loading the frame again
    props.locale = 'he';
    await expect.poll(() => root.lang).toBe('he');
    expect(root.dir).toBe('rtl');

    props.locale = 'en';
    await expect.poll(() => root.dir).toBe('ltr');
    expect(root.lang).toBe('en');

    // A locale code that isn’t a valid language tag
    props.locale = 'en_US';
    await expect.poll(() => root.hasAttribute('lang')).toBe(false);
    expect(root.dir).toBe('ltr');

    // Without i18n, neither the language nor the direction is known
    props.locale = '_default';
    await expect.poll(() => root.hasAttribute('dir')).toBe(false);
    expect(root.hasAttribute('lang')).toBe(false);
  });

  test('sets no language or direction without i18n', async () => {
    const { container } = await renderWithDraft(EntryPreviewIframe, {
      draft: createMockDraft(),
      props: { locale: '_default', styleURLs: [], children },
    });

    await expect
      .poll(() => getDocument(container)?.querySelector('.preview-content')?.textContent)
      .toBe('Hello');

    const root = /** @type {Document} */ (getDocument(container)).documentElement;

    expect(root.hasAttribute('lang')).toBe(false);
    expect(root.hasAttribute('dir')).toBe(false);
  });

  test('tears down the content mounted in the frame when it’s unmounted', async () => {
    const teardown = vi.fn();

    const { container, unmount } = await renderWithDraft(EntryPreviewIframe, {
      draft: createMockDraft(),
      props: {
        locale: 'en',
        styleURLs: [],
        children: createRawSnippet(() => ({
          /**
           * Render the content.
           * @returns {string} HTML.
           */
          render: () => '<p class="preview-content">Hello</p>',
          /**
           * Set up the content.
           * @returns {() => void} Teardown.
           */
          setup: () => teardown,
        })),
      },
    });

    await expect
      .poll(() => getDocument(container)?.querySelector('.preview-content')?.textContent)
      .toBe('Hello');
    expect(teardown).not.toHaveBeenCalled();

    unmount();

    expect(teardown).toHaveBeenCalledOnce();
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

  test('highlights the Edit Pane field of an element marked in a React component', async () => {
    /** @type {any[]} */
    const messages = [];

    /**
     * Record a message.
     * @param {MessageEvent} event Event.
     */
    const onMessage = (event) => {
      messages.push(event.data);
    };

    /**
     * A component marking its elements with key paths.
     * @returns {any} React element.
     */
    const Page = () =>
      createElement(
        'article',
        { 'data-key-path': 'sections.0' },
        createElement(
          'h2',
          { 'data-key-path': 'sections.0.heading', tabIndex: 0 },
          createElement('span', { className: 'heading' }, 'Heading'),
        ),
        createElement('p', { className: 'intro' }, 'Intro'),
        createElement(
          'a',
          {
            className: 'link',
            'data-key-path': 'sections.0.link',
            href: '#',
            /**
             * Prevent the default action.
             * @param {Event} event Event.
             */
            onClick: (event) => {
              event.preventDefault();
            },
          },
          'Link',
        ),
      );

    window.addEventListener('message', onMessage);

    try {
      const { container } = await renderWithDraft(EntryPreviewIframe, {
        draft: createMockDraft(),
        props: { locale: 'fr', styleURLs: [], reactComponent: Page, reactProps: {} },
      });

      await expect.poll(() => getDocument(container)?.querySelector('.heading')).toBeTruthy();

      const doc = /** @type {Document} */ (getDocument(container));
      const heading = /** @type {HTMLElement} */ (doc.querySelector('h2'));

      /** @type {HTMLElement} */ (doc.querySelector('.heading')).click();
      /** @type {HTMLElement} */ (doc.querySelector('.intro')).click();
      // The component prevents the default action of the link, so it’s not highlighted
      /** @type {HTMLElement} */ (doc.querySelector('.link')).click();
      heading.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      await expect
        .poll(() => messages)
        .toEqual([
          {
            type: 'highlight-editor-field',
            payload: { locale: 'fr', keyPath: 'sections.0.heading' },
          },
          { type: 'highlight-editor-field', payload: { locale: 'fr', keyPath: 'sections.0' } },
          {
            type: 'highlight-editor-field',
            payload: { locale: 'fr', keyPath: 'sections.0.heading' },
          },
        ]);
    } finally {
      window.removeEventListener('message', onMessage);
    }
  });
});
