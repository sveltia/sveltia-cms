import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { customComponentRegistry } from '$lib/services/api/registries';
import { globalAssetFolder } from '$lib/services/assets/folders';
import { cmsConfig } from '$lib/services/config';
import { trackPendingFieldUpdate } from '$lib/services/contents/editor/pending';
import { createMockImageFile, initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import RichTextEditor from './rich-text-editor.svelte';

vi.mock('$lib/services/contents/editor/pending', () => ({
  trackPendingFieldUpdate: vi.fn(),
  awaitPendingFieldUpdates: vi.fn(),
  afterPendingFieldUpdates: vi.fn(async (fn) => fn()),
}));

/**
 * @import { RichTextField } from '$lib/types/public';
 */

/**
 * Render the editor within a draft.
 * @param {string} currentValue Markdown.
 * @param {Partial<RichTextField>} [config] Field options.
 * @param {object} [options] Options.
 * @param {string} [options.collectionName] Collection name.
 * @param {Record<string, any>} [options.context] Field editor context to override.
 * @param {Record<string, any>} [options.props] Props to override.
 * @returns {Promise<{ props: any, container: HTMLElement, draft: any }>} Props, container and
 * draft.
 */
const renderEditor = async (
  currentValue,
  config = {},
  { collectionName = 'posts', context = {}, props: extra = {} } = {},
) => {
  /** @type {RichTextField} */
  const fieldConfig = { name: 'body', widget: 'richtext', ...config };

  const props = $state({
    locale: 'en',
    keyPath: 'body',
    typedKeyPath: 'body',
    fieldId: 'body',
    fieldLabel: 'Body',
    fieldConfig,
    currentValue,
    ...extra,
  });

  const draft = createMockDraft({
    collectionName,
    fields: [fieldConfig],
    i18n: { defaultLocale: 'en', allLocales: ['en'] },
    values: { en: { body: currentValue } },
  });

  const { container } = await renderWithDraft(RichTextEditor, {
    draft,
    props,
    // The editor is always rendered within a field editor
    context: {
      'field-editor': { parentComponentNames: [], valueStoreKey: 'currentValues', ...context },
    },
  });

  return { props, container, draft };
};

describe('RichTextEditor', () => {
  beforeEach(() => {
    cmsConfig.current = /** @type {any} */ ({});
  });

  test('shows the Markdown as rich text with the formatting toolbar', async () => {
    await renderEditor('# Title\n\nSome **bold** text.');

    const editor = page.getByRole('textbox');

    await expect.poll(() => editor.element().querySelector('h1')?.textContent).toBe('Title');
    expect(editor.element().querySelector('strong')).toHaveTextContent('bold');
    await expect.element(page.getByRole('button', { name: 'Bold' })).toBeVisible();
  });

  test('stores the edited content as Markdown', async () => {
    const { props } = await renderEditor('Hello');
    const editor = page.getByRole('textbox');

    await expect.poll(() => editor.element().textContent).toBe('Hello');
    await editor.fill('Hello, world!');
    await expect.poll(() => props.currentValue).toBe('Hello, world!');
  });

  test('follows an external change to the value', async () => {
    const { props } = await renderEditor('Hello');

    props.currentValue = 'Changed';

    await expect.poll(() => page.getByRole('textbox').element().textContent).toBe('Changed');
  });

  test('limits the toolbar to the configured buttons and modes', async () => {
    const { container } = await renderEditor('Hi', {
      buttons: ['bold'],
      modes: ['raw'],
      minimal: true,
    });

    expect(container.querySelector('.wrapper')).toHaveClass('minimal');
    await expect.element(page.getByRole('button', { name: 'Bold' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Italic' }).elements()).toHaveLength(0);
  });

  test('tracks a pending update while typing', async () => {
    const { props } = await renderEditor('Hello');
    const editor = page.getByRole('textbox');

    await expect.poll(() => editor.element().textContent).toBe('Hello');
    await editor.click();
    await userEvent.keyboard('{End}!');

    // A save waits for the update, which is settled once the Markdown is written back
    await vi.waitFor(() => expect(trackPendingFieldUpdate).toHaveBeenCalledOnce());
    await expect(vi.mocked(trackPendingFieldUpdate).mock.calls[0][0]).resolves.toBeUndefined();
    expect(props.currentValue).toBe('Hello!');
  });

  test('tracks a pending update for a change made with the toolbar', async () => {
    const { props } = await renderEditor('Hello');
    const editor = page.getByRole('textbox');

    await expect.poll(() => editor.element().textContent).toBe('Hello');

    // An attribute change on the editor’s root element doesn’t change the content
    props.invalid = true;
    await expect.poll(() => editor.element().getAttribute('aria-invalid')).toBe('true');

    // Select the text, and let the editor pick up the selection, then make it bold with the toolbar
    const range = document.createRange();

    range.selectNodeContents(editor.element());
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
    expect(trackPendingFieldUpdate).not.toHaveBeenCalled();
    await page.getByRole('button', { name: 'Bold' }).click();

    await vi.waitFor(() => expect(trackPendingFieldUpdate).toHaveBeenCalledOnce());
    await expect(vi.mocked(trackPendingFieldUpdate).mock.calls[0][0]).resolves.toBeUndefined();
    expect(props.currentValue).toBe('**Hello**');
  });

  test('neither tracks an update nor writes back a value in another style when it’s loaded', async () => {
    const { props } = await renderEditor('Some *italic* text.');
    const editor = page.getByRole('textbox');

    await expect.poll(() => editor.element().textContent).toBe('Some italic text.');
    // Give the editor time to convert the content, which it would write as `_italic_`
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    expect(trackPendingFieldUpdate).not.toHaveBeenCalled();
    expect(props.currentValue).toBe('Some *italic* text.');

    // A change made by the user is written, in the editor’s style
    await editor.click();
    await userEvent.keyboard('{End}!');
    await expect.poll(() => props.currentValue).toBe('Some _italic_ text.!');
  });

  test('writes a change typed in the Markdown mode', async () => {
    const { props } = await renderEditor('Hello', { modes: ['raw'] });
    const source = page.getByRole('textbox');

    await expect.element(source).toHaveValue('Hello');
    await source.click();
    await userEvent.keyboard('{End}!');
    await expect.poll(() => props.currentValue).toBe('Hello!');
  });

  test('inserts a dropped image', async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'body', widget: 'richtext' }],
        },
      ],
    });

    const { props, draft } = await renderEditor('Hello');
    const editor = page.getByRole('textbox');

    await expect.poll(() => editor.element().textContent).toBe('Hello');

    const dataTransfer = new DataTransfer();

    dataTransfer.items.add(await createMockImageFile({ name: 'photo.png' }));
    editor
      .element()
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));

    // The file is held in the draft under a temporary URL
    await expect.poll(() => props.currentValue).toMatch(/!\[\]\(blob:[^)]+\)/);
    expect(Object.values(draft.files)[0]).toEqual(
      expect.objectContaining({ folder: globalAssetFolder.current }),
    );

    // A file that isn’t a valid image is skipped
    const broken = new DataTransfer();

    broken.items.add(new File(['x'], 'broken.png', { type: 'image/png' }));
    editor
      .element()
      .dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: broken }),
      );
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    expect(Object.keys(draft.files)).toHaveLength(1);
  });

  test('inserts a pasted image, and ignores other content', async () => {
    const { props } = await renderEditor('Hello');
    const editor = page.getByRole('textbox');

    await expect.poll(() => editor.element().textContent).toBe('Hello');

    const dataTransfer = new DataTransfer();

    dataTransfer.items.add(await createMockImageFile({ name: 'pasted.png' }));
    editor.element().dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      }),
    );

    await expect.poll(() => props.currentValue).toMatch(/!\[\]\(blob:[^)]+\)/);

    // Plain text is left to the editor
    const text = new DataTransfer();

    text.setData('text/plain', 'plain');
    editor
      .element()
      .dispatchEvent(
        new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: text }),
      );
    await expect.poll(() => props.currentValue).not.toContain('plain');
  });

  test('offers no components when nested ones are disabled by the parent field', async () => {
    await initTestConfig({
      collections: [
        {
          name: 'nested-off',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'body', widget: 'richtext', allow_nested_components: false }],
        },
      ],
    });

    await renderEditor(
      'Hi',
      {},
      {
        // The field config is cached per collection, so each test uses its own one
        collectionName: 'nested-off',
        context: { fieldContext: 'rich-text-editor-component', parentComponentNames: ['card'] },
        props: { keyPath: 'body:c1:content', typedKeyPath: 'body:c1:content' },
      },
    );

    await expect.element(page.getByRole('button', { name: 'Bold' })).toBeVisible();
    expect(page.getByRole('button', { name: /Insert/ }).elements()).toHaveLength(0);
  });

  test('leaves the current component out of the nested ones', async () => {
    await initTestConfig({
      collections: [
        {
          name: 'nested-self',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'body', widget: 'richtext', allow_nested_components: 'exclude_self' }],
        },
      ],
    });

    await renderEditor(
      'Hi',
      {},
      {
        collectionName: 'nested-self',
        // The parent component name is the definition ID, which is `linked-image` for an image
        // while linked images are enabled
        context: {
          fieldContext: 'rich-text-editor-component',
          parentComponentNames: ['linked-image'],
        },
        props: { keyPath: 'body:c1:content', typedKeyPath: 'body:c1:content' },
      },
    );

    await expect.element(page.getByRole('button', { name: 'Bold' })).toBeVisible();
    // Other components are still offered; the code block is a text style
    await page.getByRole('button', { name: 'Show Text Style Options' }).click();
    await expect.element(page.getByRole('menuitemcheckbox', { name: 'Code Block' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(page.getByRole('button', { name: /Image/ }).elements()).toHaveLength(0);

    // The image component is left out, so a dropped image goes nowhere
    const dataTransfer = new DataTransfer();

    dataTransfer.items.add(await createMockImageFile({ name: 'photo.png' }));

    const editor = page.getByRole('textbox');

    await expect.poll(() => editor.element().textContent).toBe('Hi');
    editor
      .element()
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    await expect.poll(() => editor.element().textContent).toBe('Hi');
  });

  test('leaves the current custom component out of the nested ones', async () => {
    customComponentRegistry.set('youtube', {
      id: 'youtube',
      label: 'YouTube',
      // Show a toolbar button instead of an item in the Insert menu
      trigger: 'button',
      fields: [{ name: 'id', label: 'ID' }],
      pattern: /^youtube (\S+)$/,
      // eslint-disable-next-line jsdoc/require-jsdoc
      toBlock: ({ id }) => `youtube ${id}`,
    });

    try {
      await initTestConfig({
        collections: [
          {
            name: 'nested-self-custom',
            label: 'Posts',
            folder: 'content/posts',
            fields: [{ name: 'body', widget: 'richtext', allow_nested_components: 'exclude_self' }],
          },
        ],
      });

      await renderEditor(
        'Hi',
        {},
        {
          collectionName: 'nested-self-custom',
          // The parent component name is the prefixed definition ID
          context: {
            fieldContext: 'rich-text-editor-component',
            parentComponentNames: ['x-youtube'],
          },
          props: { keyPath: 'body:c1:content', typedKeyPath: 'body:c1:content' },
        },
      );

      await expect.element(page.getByRole('button', { name: 'Bold' })).toBeVisible();
      // The image component is still offered
      await expect.element(page.getByRole('button', { name: /Image/ })).toBeVisible();
      expect(page.getByRole('button', { name: /YouTube/ }).elements()).toHaveLength(0);
    } finally {
      customComponentRegistry.delete('youtube');
    }
  });

  test('cleans up the values of removed components', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    try {
      const { props, draft } = await renderEditor('Hello');

      draft.extraValues.en['body:c1:title'] = 'gone';
      // Values of other fields, and those without a component prefix, are left alone
      draft.extraValues.en['summary:c1:title'] = 'kept';
      draft.extraValues.en.plain = 'kept';
      props.currentValue = 'Changed';
      await vi.advanceTimersByTimeAsync(600);
      expect(draft.extraValues.en['body:c1:title']).toBeUndefined();
      expect(draft.extraValues.en['summary:c1:title']).toBe('kept');
      expect(draft.extraValues.en.plain).toBe('kept');
    } finally {
      vi.useRealTimers();
    }
  });

  test('shows an empty editor when the value is not a string', async () => {
    const { props } = await renderEditor(/** @type {any} */ (undefined));
    const editor = page.getByRole('textbox');

    await expect.element(editor).toBeVisible();
    expect(editor.element().textContent).toBe('');

    props.currentValue = /** @type {any} */ (42);
    await expect.poll(() => editor.element().textContent).toBe('');
  });

  test('offers the code block type only when the component is enabled', async () => {
    await renderEditor('Hi', { buttons: [], editor_components: ['image'] });
    await expect.element(page.getByRole('textbox')).toBeVisible();
    // Only paragraphs are left, so there’s no text style menu
    expect(page.getByRole('button', { name: 'Show Text Style Options' }).elements()).toHaveLength(
      0,
    );
  });

  test('inserts a dropped external image, and ignores dropped text', async () => {
    const { props } = await renderEditor('Hello');
    const editor = page.getByRole('textbox');

    await expect.poll(() => editor.element().textContent).toBe('Hello');

    const text = new DataTransfer();

    text.setData('text/plain', 'plain');
    editor
      .element()
      .dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: text }),
      );
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    expect(props.currentValue).toBe('Hello');

    // An image from another site is linked as is
    const html = new DataTransfer();

    html.setData('text/html', '<img src="https://example.com/photo.png" alt="Photo">');
    editor
      .element()
      .dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: html }),
      );
    await expect
      .poll(() => props.currentValue)
      .toContain('![Photo](https://example.com/photo.png)');
  });
});
