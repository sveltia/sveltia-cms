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
  getLeafletMarkerIconURL: vi.fn(
    async () => 'https://unpkg.com/leaflet/dist/images/marker-icon-2x.png',
  ),
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

  test('marks each field outside its lazily rendered preview', async () => {
    await renderPreview();

    const document = page.getByRole('document', { name: 'Content Preview' });

    await expect.element(document.getByText('World')).toBeInTheDocument();

    const wrappers = [...document.element().children];

    // For the Edit Pane to scroll to a field before it’s rendered. The wrapper isn’t padded like
    // the document, and doesn’t take the key path Scroll Sync and Click-to-Highlight look for
    expect(wrappers.map((el) => el.getAttribute('data-lazy-key-path'))).toEqual(['title', 'body']);
    expect(wrappers.map((el) => el.querySelector('section')?.dataset.keyPath)).toEqual([
      'title',
      'body',
    ]);
    expect(wrappers.every((el) => !el.hasAttribute('data-key-path'))).toBe(true);
    expect(getComputedStyle(wrappers[0]).padding).toBe('0px');
    expect(getComputedStyle(document.element()).padding).toBe('8px 16px');
  });

  test('confines the field previews to the preview box', async () => {
    await renderPreview();

    const document = page.getByRole('document', { name: 'Content Preview' });

    await expect.element(document).toBeInTheDocument();
    // A positioned element in the content written by other users can’t cover the app
    expect(getComputedStyle(document.element()).contain).toBe('paint');
  });

  test('renders the preview in a frame with the custom styles', async () => {
    customPreviewStyleRegistry.add({ url: 'https://example.com/preview.css' });

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
    // The fields are marked in the frame too, for the Edit Pane to scroll to them
    expect(
      [...(iframe.contentDocument?.querySelectorAll('[data-lazy-key-path]') ?? [])].map((el) =>
        el.getAttribute('data-lazy-key-path'),
      ),
    ).toEqual(['title', 'body']);
  });

  test('renders the preview in a frame with the styles for the entry’s collection only', async () => {
    customPreviewStyleRegistry.add({ url: 'https://example.com/posts.css', collection: 'posts' });
    customPreviewStyleRegistry.add({ url: 'https://example.com/pages.css', collection: 'pages' });

    const { container } = await renderPreview();
    const iframe = /** @type {HTMLIFrameElement} */ (container.querySelector('iframe.preview'));

    await expect
      .poll(() =>
        [...(iframe.contentDocument?.querySelectorAll('link[rel="stylesheet"]') ?? [])].map(
          (link) => link.getAttribute('href'),
        ),
      )
      .toEqual(['https://example.com/posts.css']);
  });

  test('doesn’t use a frame when the custom styles are for other collections', async () => {
    customPreviewStyleRegistry.add({ url: 'https://example.com/pages.css', collection: 'pages' });

    const { container } = await renderPreview();

    await expect
      .element(page.getByRole('document', { name: 'Content Preview' }).getByText('Hello'))
      .toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
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

  test('renders a custom preview template calling `widgetFor()` with an unknown field', async () => {
    /**
     * A template asking for a field that isn’t configured, which gets `null` as in Netlify/Decap
     * CMS, rather than the whole preview failing.
     * @param {any} props Props.
     * @returns {any} React element.
     */
    const Template = ({ entry, widgetFor }) =>
      createElement(
        'article',
        null,
        createElement('h1', null, entry.getIn(['data', 'title'])),
        createElement('p', null, String(widgetFor('missing'))),
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
    await expect.poll(() => getBody()?.querySelector('p')?.textContent).toBe('null');
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
