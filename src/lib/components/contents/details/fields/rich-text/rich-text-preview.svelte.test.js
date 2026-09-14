import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { loadReactDom, reactDomLoaded } from '$lib/services/api/react-dom';
import { customComponentRegistry } from '$lib/services/api/registries';
import { cmsConfig } from '$lib/services/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import RichTextPreview from './rich-text-preview.svelte';

/**
 * @import { RichTextField } from '$lib/types/public';
 */

const { reactDomLoader } = vi.hoisted(() => ({
  /** @type {{ current: (() => Promise<any>) | undefined }} */
  reactDomLoader: { current: undefined },
}));

// Let a test hold the `react-dom` chunk back
vi.mock('$lib/services/api/react-dom', async (importOriginal) => {
  const original = /** @type {any} */ (await importOriginal());

  return {
    ...original,
    loadReactDom: vi.fn(() => (reactDomLoader.current ?? original.loadReactDom)()),
  };
});

/**
 * Render the preview, keeping the props to change the value later.
 * @param {string | undefined} currentValue Markdown.
 * @param {Partial<RichTextField>} [config] Field options.
 * @returns {Promise<{ preview: HTMLElement, props: any, unmount: () => void }>} The preview
 * container, props and unmount function.
 */
const renderPreviewWithProps = async (currentValue, config = {}) => {
  /** @type {RichTextField} */
  const fieldConfig = { name: 'body', widget: 'richtext', ...config };

  const props = $state({
    locale: '_default',
    keyPath: 'body',
    typedKeyPath: 'body',
    fieldConfig,
    currentValue,
  });

  const { container, unmount } = await renderWithDraft(RichTextPreview, {
    draft: createMockDraft({ fields: [fieldConfig] }),
    props,
  });

  return {
    preview: /** @type {HTMLElement} */ (container.querySelector('[data-rich-text-preview]')),
    props,
    unmount,
  };
};

/**
 * Render the preview.
 * @param {string | undefined} currentValue Markdown.
 * @param {Partial<RichTextField>} [config] Field options.
 * @returns {Promise<HTMLElement>} The preview container.
 */
const renderPreview = async (currentValue, config = {}) => {
  const { preview } = await renderPreviewWithProps(currentValue, config);

  return preview;
};

/**
 * Define a custom component with the given preview.
 * @param {(data: any) => any} toPreview Preview builder.
 * @returns {void}
 */
const defineGreeting = (toPreview) => {
  customComponentRegistry.set('greeting', {
    id: 'greeting',
    label: 'Greeting',
    fields: [{ name: 'name', widget: 'string' }],
    pattern: /^:::greeting (?<name>.+)$/m,
    /**
     * Build the Markdown.
     * @param {any} data Data.
     * @returns {string} Markdown.
     */
    toBlock: ({ name }) => `:::greeting ${name}`,
    toPreview,
  });
};

describe('RichTextPreview', () => {
  beforeEach(() => {
    cmsConfig.current = /** @type {any} */ ({});
  });

  afterEach(() => {
    customComponentRegistry.clear();
  });

  test('renders Markdown as HTML, block by block', async () => {
    const preview = await renderPreview('# Title\n\nSome **bold** text.\n\n- a\n- b');

    await expect.poll(() => preview.querySelector('h1')?.textContent).toBe('Title');
    expect(preview.querySelector('p')?.innerHTML).toBe('Some <strong>bold</strong> text.');
    expect([...preview.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['a', 'b']);
  });

  test('sanitizes the HTML unless configured otherwise', async () => {
    const markdown = '<p onclick="alert(1)">Hi</p>\n\n<script>alert(1)</script>';
    const sanitized = await renderPreview(markdown);

    await expect.poll(() => sanitized.querySelector('p')?.textContent).toBe('Hi');
    expect(sanitized.querySelector('p')).not.toHaveAttribute('onclick');
    expect(sanitized.querySelector('script')).toBeNull();

    const raw = await renderPreview(markdown, { sanitize_preview: false });

    await expect.poll(() => raw.querySelector('p')).not.toBeNull();
    expect(raw.querySelector('p')).toHaveAttribute('onclick');
  });

  test('renders an image with its resolved URL', async () => {
    const preview = await renderPreview('![Photo](https://example.com/photo.png)');

    await expect
      .poll(() => preview.querySelector('img')?.getAttribute('src'))
      .toBe('https://example.com/photo.png');
    expect(preview.querySelector('img')).toHaveAttribute('alt', 'Photo');
  });

  test('mounts a custom editor component preview', async () => {
    customComponentRegistry.set('greeting', {
      id: 'greeting',
      label: 'Greeting',
      fields: [{ name: 'name', widget: 'string' }],
      pattern: /^:::greeting (?<name>.+)$/m,
      /**
       * Build the Markdown.
       * @param {any} data Data.
       * @returns {string} Markdown.
       */
      toBlock: ({ name }) => `:::greeting ${name}`,
      /**
       * Build the preview.
       * @param {any} data Data.
       * @returns {any} React element.
       */
      toPreview: ({ name }) => createElement('strong', {}, `Hello, ${name}!`),
    });

    const preview = await renderPreview('Intro\n\n:::greeting World\n\nOutro');

    await expect.poll(() => preview.querySelector('strong')?.textContent).toBe('Hello, World!');
  });

  test('renders nothing without content', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview('  ')).children).toHaveLength(0);
  });

  test('highlights the code blocks once the grammar is loaded', async () => {
    const preview = await renderPreview(
      '```js\nconst a = 1;\n```\n\n```js\nlet b;\n```\n\n```\nplain\n```',
    );

    await expect.poll(() => preview.querySelectorAll('pre.shiki').length).toBe(2);
    // A code block without a language is left alone
    expect(preview.querySelectorAll('pre').length).toBe(3);
    expect(preview.querySelector('pre:not(.shiki)')).toHaveTextContent('plain');
  });

  test('leaves an image that can’t be resolved as is', async () => {
    const preview = await renderPreview('![Missing](missing.png)');

    await expect.poll(() => preview.querySelector('img')?.dataset.processed).toBe('true');
    expect(preview.querySelector('img')).toHaveAttribute('src', 'missing.png');
  });

  test('mounts an element preview, and notifies it when it’s removed', async () => {
    const element = document.createElement('em');

    element.textContent = 'Hi';

    const onUnmount = vi.fn();

    element.addEventListener('Unmount', onUnmount);
    defineGreeting(() => element);

    const { preview, props, unmount } = await renderPreviewWithProps(':::greeting World');

    await expect.poll(() => preview.querySelector('em')?.textContent).toBe('Hi');

    // The element is taken out along with the component
    props.currentValue = 'Plain text';
    await vi.waitFor(() => expect(onUnmount).toHaveBeenCalledOnce());

    // Every preview is notified when the field preview goes away
    props.currentValue = ':::greeting Again';
    await expect.poll(() => preview.querySelector('em')?.textContent).toBe('Hi');
    unmount();
    expect(onUnmount).toHaveBeenCalledTimes(2);
  });

  test('unmounts a React preview that is removed', async () => {
    defineGreeting(({ name }) => createElement('strong', {}, `Hello, ${name}!`));

    const { preview, props } = await renderPreviewWithProps(':::greeting World');

    await expect.poll(() => preview.querySelector('strong')?.textContent).toBe('Hello, World!');

    props.currentValue = 'Plain text';
    await expect.poll(() => preview.querySelector('strong')).toBeNull();
  });

  test('leaves a React preview alone if its placeholder is gone before `react-dom` loads', async () => {
    defineGreeting(({ name }) => createElement('strong', {}, `Hello, ${name}!`));

    const { promise, resolve: release } = Promise.withResolvers();
    const loaded = reactDomLoaded.current;

    reactDomLoaded.current = false;
    /**
     * Hold the chunk back until released.
     * @returns {Promise<any>} Resolves once released.
     */
    reactDomLoader.current = () => promise;

    try {
      const { preview, props } = await renderPreviewWithProps(':::greeting World');

      await vi.waitFor(() => expect(loadReactDom).toHaveBeenCalled());
      props.currentValue = 'Plain text';
      await expect.poll(() => preview.querySelector('[data-component-key]')).toBeNull();
      release(undefined);
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(preview.querySelector('strong')).toBeNull();
    } finally {
      reactDomLoaded.current = loaded;
      reactDomLoader.current = undefined;
    }
  });

  test('drops a component placeholder without a valid preview', async () => {
    defineGreeting(() => /** @type {any} */ ({ nope: true }));

    const preview = await renderPreview('Intro\n\n:::greeting World');

    await expect.poll(() => preview.textContent?.trim()).toBe('Intro');
  });

  test('handles the elements added to the preview after the fact', async () => {
    const element = document.createElement('em');

    element.textContent = 'Hi';
    defineGreeting(() => element);

    const preview = await renderPreview(':::greeting World');

    await expect.poll(() => preview.querySelector('em')?.textContent).toBe('Hi');

    // A placeholder added on its own is rendered, and an image within a wrapper is processed
    const original = /** @type {HTMLElement} */ (preview.querySelector('[data-component-key]'));
    const placeholder = document.createElement('span');

    placeholder.dataset.componentKey = original.dataset.componentKey;

    const wrapper = document.createElement('div');

    wrapper.innerHTML = '<img src="https://example.com/late.png" alt="">';
    preview.append(placeholder, wrapper);

    await expect.poll(() => placeholder.querySelector('em')?.textContent).toBe('Hi');
    await expect.poll(() => wrapper.querySelector('img')?.dataset.processed).toBe('true');

    // A placeholder without a key has no preview
    const stray = document.createElement('span');

    stray.dataset.componentKey = '';
    preview.append(stray);
    await expect.poll(() => stray.isConnected).toBe(false);
  });
});
