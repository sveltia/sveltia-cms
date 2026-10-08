import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { loadReactDom, reactDomLoaded } from '$lib/services/api/react-dom';
import { customComponentRegistry } from '$lib/services/api/registries';
import { allAssetFolders } from '$lib/services/assets/folders';
import { allAssets } from '$lib/services/assets/state';
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

  test('renders an HTML value as is, without parsing it as Markdown', async () => {
    defineGreeting(() => '<b class="greeting">Hello</b>');

    const preview = await renderPreview(
      '<h2>Title</h2>\n<p>Some *literal* text</p>\n\n:::greeting World\n\n```js\nconst a = 1;\n```',
      { format: 'html' },
    );

    await expect.poll(() => preview.querySelector('h2')?.textContent).toBe('Title');
    expect(preview.querySelector('p')?.textContent).toBe('Some *literal* text');
    // Neither Markdown syntax nor editor components are converted
    expect(preview.querySelector('em')).toBeNull();
    expect(preview.querySelector('pre')).toBeNull();
    expect(preview.querySelector('.greeting')).toBeNull();
    expect(preview).toMatchTextContent(/:::greeting World/);
  });

  test('takes the HTML format from the field defaults', async () => {
    cmsConfig.current = /** @type {any} */ ({ field_defaults: { richtext: { format: 'html' } } });

    const preview = await renderPreview('<p>Some *literal* text</p>\n\n# Not a heading');

    await expect.poll(() => preview.querySelector('p')?.textContent).toBe('Some *literal* text');
    expect(preview.querySelector('h1')).toBeNull();
  });

  test('follows a change to an HTML value', async () => {
    const { preview, props } = await renderPreviewWithProps('<p>Hello</p>', { format: 'html' });

    await expect.poll(() => preview.querySelector('p')?.textContent).toBe('Hello');

    props.currentValue = '<h2>Changed</h2>';

    await expect.poll(() => preview.querySelector('h2')?.textContent).toBe('Changed');
    expect(preview.querySelector('p')).toBeNull();
  });

  test('renders the preview of a component with HTML syntax in an HTML value', async () => {
    customComponentRegistry.set('note', {
      id: 'note',
      label: 'Note',
      fields: [{ name: 'text', widget: 'string' }],
      pattern: /^:::note (?<text>.+)$/m,
      // eslint-disable-next-line jsdoc/require-jsdoc
      toBlock: ({ text }) => `:::note ${text}`,
      // eslint-disable-next-line jsdoc/require-jsdoc
      toPreview: ({ text }) => {
        const element = document.createElement('strong');

        element.className = 'note-preview';
        element.textContent = text;

        return element;
      },
      htmlSelector: 'aside.note',
      // eslint-disable-next-line jsdoc/require-jsdoc
      fromBlockHTML: (element) => ({ text: element.textContent }),
      // eslint-disable-next-line jsdoc/require-jsdoc
      toBlockHTML: ({ text }) => `<aside class="note">${text}</aside>`,
    });

    const { preview, props } = await renderPreviewWithProps(
      '<p>Intro</p><aside class="note">Heads up</aside>',
      { format: 'html' },
    );

    await expect.poll(() => preview.querySelector('.note-preview')?.textContent).toBe('Heads up');
    expect(preview.querySelector('aside')).toBeNull();
    expect(preview.querySelector('p')?.textContent).toBe('Intro');

    // Only the changed block is rendered again, so the preview stays where it is
    const placeholder = preview.querySelector('[data-component-key]');

    props.currentValue = '<p>Changed</p><aside class="note">Heads up</aside>';

    await expect.poll(() => preview.querySelector('p')?.textContent).toBe('Changed');
    expect(preview.querySelector('[data-component-key]')).toBe(placeholder);
    expect(preview.querySelector('.note-preview')?.textContent).toBe('Heads up');
  });

  test('sanitizes an HTML value unless configured otherwise', async () => {
    const html = '<p onclick="alert(1)">Hi</p><script>alert(1)</script>';
    const sanitized = await renderPreview(html, { format: 'html' });

    await expect.poll(() => sanitized.querySelector('p')?.textContent).toBe('Hi');
    expect(sanitized.querySelector('p')).not.toHaveAttribute('onclick');
    expect(sanitized.querySelector('script')).toBeNull();

    const raw = await renderPreview(html, { format: 'html', sanitize_preview: false });

    await expect.poll(() => raw.querySelector('p')).not.toBeNull();
    expect(raw.querySelector('p')).toHaveAttribute('onclick');
  });

  test('keeps the content within the preview', async () => {
    const preview = await renderPreview(
      '<style>body { display: none; }</style>\n\n' +
        '<div class="cover" style="position: fixed; inset: 0">Sign in again</div>',
    );

    await expect.poll(() => preview.querySelector('.cover')).not.toBeNull();
    expect(preview.querySelector('style')).toBeNull();
    expect(getComputedStyle(document.body).display).not.toBe('none');

    // An element with `position: fixed` is positioned within the preview, not the window
    const { top, height } = /** @type {HTMLElement} */ (
      preview.querySelector('.cover')
    ).getBoundingClientRect();

    const box = preview.getBoundingClientRect();

    expect(top).toBe(box.top);
    expect(height).toBe(box.height);
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

  test('resolves the URLs of videos, audio and image sets', async () => {
    const folder = { internalPath: 'static/uploads', publicPath: '/uploads', entryRelative: false };

    allAssetFolders.current = /** @type {any[]} */ ([folder]);
    allAssets.current = /** @type {any[]} */ (
      ['clip.mp4', 'poster.jpg', 'song.mp3', 'small.jpg', 'large.jpg'].map((name) => ({
        path: `static/uploads/${name}`,
        name,
        folder,
        blobURL: `blob:${name}`,
      }))
    );

    try {
      const preview = await renderPreview(
        '<video src="/uploads/clip.mp4" poster="/uploads/poster.jpg"></video>\n\n' +
          '<audio controls><source src="/uploads/song.mp3" type="audio/mpeg"></audio>\n\n' +
          '<img srcset="/uploads/small.jpg 1x, /uploads/large.jpg 2x" alt="">',
      );

      await expect
        .poll(() => preview.querySelector('video')?.getAttribute('src'))
        .toBe('blob:clip.mp4');
      expect(preview.querySelector('video')).toHaveAttribute('poster', 'blob:poster.jpg');
      await expect
        .poll(() => preview.querySelector('source')?.getAttribute('src'))
        .toBe('blob:song.mp3');
      await expect
        .poll(() => preview.querySelector('img')?.getAttribute('srcset'))
        .toBe('blob:small.jpg 1x, blob:large.jpg 2x');
    } finally {
      allAssetFolders.current = [];
      allAssets.current = [];
    }
  });

  test('resolves an image in a component preview from the component’s media folder', async () => {
    customComponentRegistry.set('figure', {
      id: 'figure',
      label: 'Figure',
      fields: [
        {
          name: 'src',
          widget: 'image',
          media_folder: '/static/figures',
          public_folder: '/figures',
        },
      ],
      pattern: /^:::figure (?<src>.+)$/m,
      /**
       * Build the Markdown.
       * @param {any} data Data.
       * @returns {string} Markdown.
       */
      toBlock: ({ src }) => `:::figure ${src}`,
      /**
       * Build the preview.
       * @param {any} data Data.
       * @returns {string} HTML.
       */
      toPreview: ({ src }) => `<img src="${src}" alt="">`,
    });
    allAssetFolders.current = /** @type {any[]} */ ([
      { internalPath: 'static/uploads', publicPath: '/uploads', entryRelative: false },
      {
        componentName: 'figure',
        typedKeyPath: 'src',
        internalPath: 'static/figures',
        publicPath: '/figures',
        entryRelative: false,
        hasTemplateTags: false,
      },
    ]);
    allAssets.current = /** @type {any[]} */ ([
      { path: 'static/figures/photo.png', name: 'photo.png', blobURL: 'blob:figure-photo' },
    ]);

    try {
      const preview = await renderPreview(':::figure photo.png');

      await expect
        .poll(() => preview.querySelector('img')?.getAttribute('src'))
        .toBe('blob:figure-photo');
    } finally {
      allAssetFolders.current = [];
      allAssets.current = [];
    }
  });

  test('passes an asset getter to the component preview', async () => {
    customComponentRegistry.set('video', {
      id: 'video',
      label: 'Video',
      fields: [
        { name: 'src', widget: 'file', media_folder: '/static/videos', public_folder: '/videos' },
      ],
      pattern: /^:::video (?<src>.+)$/m,
      /**
       * Build the Markdown.
       * @param {any} data Data.
       * @returns {string} Markdown.
       */
      toBlock: ({ src }) => `:::video ${src}`,
      /**
       * Build the preview with the asset URL, which the preview can’t resolve by itself.
       * @param {any} data Data.
       * @param {any} getAsset Asset getter.
       * @returns {HTMLElement} Element.
       */
      toPreview: ({ src }, getAsset) => {
        const video = document.createElement('video');

        video.src = getAsset(src)?.url ?? '';
        video.dataset.path = src;

        return video;
      },
    });

    const videoFolder = {
      componentName: 'video',
      typedKeyPath: 'src',
      internalPath: 'static/videos',
      publicPath: '/videos',
      entryRelative: false,
      hasTemplateTags: false,
    };

    allAssetFolders.current = /** @type {any[]} */ ([
      { internalPath: 'static/uploads', publicPath: '/uploads', entryRelative: false },
      videoFolder,
    ]);
    allAssets.current = /** @type {any[]} */ ([
      {
        path: 'static/videos/clip.mp4',
        name: 'clip.mp4',
        blobURL: 'blob:clip',
        folder: videoFolder,
      },
    ]);

    const fieldConfig = /** @type {RichTextField} */ ({ name: 'body', widget: 'richtext' });
    const draft = createMockDraft({ fields: [fieldConfig] });
    const file = new File(['new'], 'new.mp4', { type: 'video/mp4' });

    // A file added to the draft but not saved yet is referred to with its blob URL
    draft.files = { 'blob:new-clip': { file, folder: undefined, replace: false } };

    try {
      const { container } = await renderWithDraft(RichTextPreview, {
        draft,
        props: {
          locale: '_default',
          keyPath: 'body',
          typedKeyPath: 'body',
          fieldConfig,
          currentValue: ':::video clip.mp4\n\n:::video blob:new-clip\n\n:::video missing.mp4',
        },
      });

      const preview = /** @type {HTMLElement} */ (
        container.querySelector('[data-rich-text-preview]')
      );

      /**
       * Get the `src` of the video preview for the given path.
       * @param {string} path Path.
       * @returns {string | null | undefined} Attribute value.
       */
      const getSrc = (path) =>
        preview.querySelector(`video[data-path="${path}"]`)?.getAttribute('src');

      await expect.poll(() => getSrc('clip.mp4')).toBe('blob:clip');
      expect(getSrc('blob:new-clip')).toBe('blob:new-clip');
      expect(getSrc('missing.mp4')).toBe('');
    } finally {
      allAssetFolders.current = [];
      allAssets.current = [];
    }
  });

  describe('a preview that got an asset still being retrieved', () => {
    const folder = {
      internalPath: 'static/uploads',
      publicPath: '/uploads',
      entryRelative: false,
      hasTemplateTags: false,
    };

    /** @type {(file: File) => void} */
    let resolveFile;

    beforeEach(() => {
      // The file is read from the repository once it’s requested, which the test decides when
      const file = new Promise((resolve) => {
        resolveFile = resolve;
      });

      allAssetFolders.current = /** @type {any[]} */ ([folder]);
      allAssets.current = /** @type {any[]} */ ([
        {
          path: 'static/uploads/clip.mp4',
          name: 'clip.mp4',
          folder,
          handle: { getFile: vi.fn(() => file) },
        },
      ]);
    });

    afterEach(() => {
      allAssetFolders.current = [];
      allAssets.current = [];
    });

    /**
     * Define a video component with the given preview.
     * @param {(data: any, getAsset: any) => any} toPreview Preview builder.
     * @returns {any} Spied preview builder.
     */
    const defineVideo = (toPreview) => {
      const spy = vi.fn(toPreview);

      customComponentRegistry.set('video', {
        id: 'video',
        label: 'Video',
        fields: [{ name: 'src', widget: 'file' }],
        pattern: /^:::video (?<src>.+)$/m,
        /**
         * Build the Markdown.
         * @param {any} data Data.
         * @returns {string} Markdown.
         */
        toBlock: ({ src }) => `:::video ${src}`,
        toPreview: spy,
      });

      return spy;
    };

    /**
     * Let the file be read.
     */
    const retrieveFile = () => {
      resolveFile(new File(['clip'], 'clip.mp4', { type: 'video/mp4' }));
    };

    test('replaces an element preview once the asset has its blob URL', async () => {
      const toPreview = defineVideo(({ src }, getAsset) => {
        const video = document.createElement('video');

        video.src = getAsset(src)?.url ?? '';
        video.dataset.url = getAsset(src)?.url ?? '';

        return video;
      });

      const onUnmount = vi.fn();
      const preview = await renderPreview(':::video /uploads/clip.mp4');
      /**
       * Get the video in the preview.
       * @returns {HTMLVideoElement | null} Video.
       */
      const video = () => preview.querySelector('video');

      await expect.poll(() => video()?.dataset.url).toBe('/uploads/clip.mp4');
      video()?.addEventListener('Unmount', onUnmount);
      retrieveFile();

      await expect.poll(() => video()?.dataset.url).toMatch(/^blob:/);
      expect(toPreview).toHaveBeenCalledTimes(2);
      // The previous element is told it’s gone
      expect(onUnmount).toHaveBeenCalledOnce();
    });

    test('renders a React element preview again once the asset has its blob URL', async () => {
      await loadReactDom();
      defineVideo(({ src }, getAsset) =>
        createElement('video', { 'data-url': getAsset(src)?.url ?? '' }),
      );

      const preview = await renderPreview(':::video /uploads/clip.mp4');
      /**
       * Get the URL the video preview got.
       * @returns {string | undefined} URL.
       */
      const url = () => preview.querySelector('video')?.dataset.url;

      await expect.poll(url).toBe('/uploads/clip.mp4');
      retrieveFile();
      await expect.poll(url).toMatch(/^blob:/);
      expect(preview.querySelectorAll('video')).toHaveLength(1);
    });

    test('renders a string preview again once the asset has its blob URL', async () => {
      defineVideo(({ src }, getAsset) => `<video data-url="${getAsset(src)?.url ?? ''}"></video>`);

      const preview = await renderPreview(':::video /uploads/clip.mp4');
      /**
       * Get the URL the video preview got.
       * @returns {string | undefined} URL.
       */
      const url = () => preview.querySelector('video')?.dataset.url;

      await expect.poll(url).toBe('/uploads/clip.mp4');
      retrieveFile();
      await expect.poll(url).toMatch(/^blob:/);
    });

    test('leaves a preview whose asset already has its blob URL or is gone', async () => {
      const toPreview = defineVideo(
        ({ src }, getAsset) => `<video data-url="${getAsset(src)?.url ?? ''}"></video>`,
      );

      allAssets.current[0].blobURL = 'blob:clip';

      const preview = await renderPreview(':::video /uploads/clip.mp4');

      await expect.poll(() => preview.querySelector('video')?.dataset.url).toBe('blob:clip');
      // Wait for the asset to report its URL hasn’t changed
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(toPreview).toHaveBeenCalledOnce();
    });

    test('leaves a preview that has been replaced meanwhile', async () => {
      const toPreview = defineVideo(
        ({ src }, getAsset) => `<video data-url="${getAsset(src)?.url ?? ''}"></video>`,
      );

      const { preview, props } = await renderPreviewWithProps(':::video /uploads/clip.mp4');

      await expect.poll(() => preview.querySelector('video')).not.toBeNull();
      props.currentValue = 'No video';
      await expect.poll(() => preview.querySelector('video')).toBeNull();
      retrieveFile();
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(toPreview).toHaveBeenCalledOnce();
      expect(preview.querySelector('video')).toBeNull();
    });
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
