import { createElement } from 'react';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import {
  customPreviewStyleRegistry,
  customPreviewTemplateRegistry,
} from '$lib/services/api/registries';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import EntryPreview from './entry-preview.svelte';

vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn((name) => `https://unpkg.com/${name}`),
  loadModule: vi.fn(() => import('immutable')),
  getChunkURLs: vi.fn(() => []),
  loadChunk: vi.fn(() => import('$lib/chunks/react-dom.js')),
}));

const fields = [
  { name: 'title', label: 'Title', widget: 'string' },
  { name: 'body', label: 'Body', widget: 'text' },
];

/**
 * Render the preview.
 * @returns {Promise<{ container: HTMLElement }>} Container.
 */
const renderPreview = async () => {
  const draft = createMockDraft({
    fields,
    values: { _default: { title: 'Hello', body: 'World' } },
  });

  return renderWithDraft(EntryPreview, { draft, props: { locale: '_default' } });
};

describe('EntryPreview', () => {
  beforeAll(async () => {
    // A custom template looks the fields up in the site configuration
    await initTestConfig({
      collections: [{ name: 'posts', label: 'Posts', folder: 'content/posts', fields }],
    });
  });

  afterEach(() => {
    customPreviewStyleRegistry.clear();
    customPreviewTemplateRegistry.clear();
  });

  test('renders a preview of each field', async () => {
    await renderPreview();

    const document = page.getByRole('document', { name: 'Content Preview' });

    expect(
      [...document.element().querySelectorAll('[data-key-path]')].map((el) =>
        el.getAttribute('data-key-path'),
      ),
    ).toEqual(['title', 'body']);
    await expect.element(document.getByText('Hello')).toBeInTheDocument();
    await expect.element(document.getByText('World')).toBeInTheDocument();
  });

  test('renders the preview in a frame with the custom styles', async () => {
    customPreviewStyleRegistry.add('https://example.com/preview.css');

    const { container } = await renderPreview();
    const iframe = /** @type {HTMLIFrameElement} */ (container.querySelector('iframe.preview'));

    expect(iframe).not.toBeNull();
    expect(iframe.title).toBe('Content Preview');

    await expect
      .poll(() =>
        iframe.contentDocument?.querySelector('link[rel="stylesheet"]')?.getAttribute('href'),
      )
      .toBe('https://example.com/preview.css');
    await expect
      .poll(
        () => iframe.contentDocument?.body.querySelector('[data-key-path="title"]')?.textContent,
      )
      .toContain('Hello');
  });

  test('renders a custom preview template', async () => {
    /**
     * A Netlify/Decap CMS-compatible preview template.
     * @param {any} props Props.
     * @returns {any} React element.
     */
    const Template = ({ entry, widgetFor }) =>
      createElement(
        'article',
        null,
        createElement('h1', null, entry.getIn(['data', 'title'])),
        widgetFor('body'),
      );

    customPreviewTemplateRegistry.set('posts', Template);

    const { container } = await renderPreview();

    /**
     * Get the body of the frame, which appears once the Immutable library is loaded.
     * @returns {HTMLElement | undefined} Body.
     */
    const getBody = () =>
      /** @type {HTMLIFrameElement | null} */ (container.querySelector('iframe.preview'))
        ?.contentDocument?.body;

    await expect.poll(() => getBody()?.querySelector('h1')?.textContent).toBe('Hello');
    await expect.poll(() => getBody()?.querySelector('article')?.textContent).toContain('World');
  });

  test('renders nothing without a draft', async () => {
    const { container } = await renderWithDraft(EntryPreview, {
      draft: null,
      props: { locale: '_default' },
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(container.querySelectorAll('[data-key-path]')).toHaveLength(0);
  });
});
