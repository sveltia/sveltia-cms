import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { globalAssetFolder } from '$lib/services/assets/folders';
import { activeInlineEditors } from '$lib/services/contents/editor';
import { createMockAsset, createMockImageFile, initTestConfig, setAssets } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import FileEditorItem from './file-editor-item.svelte';

/**
 * Render the item within a draft.
 * @param {string} value Field value.
 * @param {Record<string, any>} [props] Props to override.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @returns {Promise<{ draft: any, container: HTMLElement, props: any }>} Draft, container and
 * props.
 */
const renderItem = async (value, props = {}, draftProps = {}) => {
  const fieldConfig = { name: 'image', widget: 'image' };

  const draft = createMockDraft({
    fields: [fieldConfig],
    values: { _default: { image: value } },
    draft: draftProps,
  });

  const itemProps = $state({
    value,
    fieldId: 'image',
    fieldConfig,
    collectionName: 'posts',
    typedKeyPath: 'image',
    onReplace: vi.fn(),
    onRemove: vi.fn(),
    ...props,
  });

  const { container } = await renderWithDraft(FileEditorItem, { draft, props: itemProps });

  return { draft, container, props: itemProps };
};

describe('FileEditorItem', () => {
  beforeAll(async () => {
    await initTestConfig({ site_url: 'https://example.com' });
    setAssets([
      createMockAsset({
        name: 'photo.png',
        file: await createMockImageFile(),
        asset: { folder: globalAssetFolder.current },
      }),
    ]);
  });

  test('shows a saved asset with its path and the actions', async () => {
    const onReplace = vi.fn();
    const onRemove = vi.fn();
    const { container } = await renderItem('/uploads/photo.png', { onReplace, onRemove });

    await expect.element(page.getByRole('textbox')).toHaveTextContent('/uploads/photo.png');
    await expect.poll(() => container.querySelector('img')?.getAttribute('src')).toMatch(/^blob:/);
    // A saved asset can’t be renamed here
    expect(page.getByRole('button', { name: 'Rename' }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Replace Image' }).click();
    expect(onReplace).toHaveBeenCalledOnce();

    await page.getByRole('button', { name: 'Remove Image' }).click();
    expect(onRemove).toHaveBeenCalledOnce();
  });

  test('shows an image URL, without its query string', async () => {
    const { container } = await renderItem('https://images.example.com/a.jpg?w=100&h=100');

    await expect
      .element(page.getByRole('textbox'))
      .toHaveTextContent('https://images.example.com/a.jpg…');
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://images.example.com/a.jpg?w=100&h=100',
    );
  });

  test('shows a URL without a query string as is', async () => {
    const { container } = await renderItem('https://cdn.example.com/a.png');

    await expect
      .poll(() => container.querySelector('img')?.getAttribute('src'))
      .toBe('https://cdn.example.com/a.png');
    await expect
      .element(page.getByRole('textbox'))
      .toHaveTextContent('https://cdn.example.com/a.png');
  });

  test('shows a file of an unknown kind without a preview', async () => {
    const { container } = await renderItem('/uploads/notes.xyz', {
      fieldConfig: { name: 'file', widget: 'file' },
    });

    await expect.element(page.getByRole('textbox')).toHaveTextContent('/uploads/notes.xyz');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.no-thumbnail')).toHaveTextContent('draft');
  });

  test('renames an unsaved file', async () => {
    const file = await createMockImageFile({ name: 'new photo.png' });
    const blobURL = URL.createObjectURL(file);

    const { draft } = await renderItem(
      blobURL,
      {},
      { files: { [blobURL]: { file, folder: globalAssetFolder.current } } },
    );

    await expect
      .element(page.getByRole('textbox'))
      .toHaveTextContent('/static/uploads/new photo.png');

    await page.getByRole('button', { name: 'Rename' }).click();

    const input = page.getByRole('textbox');

    await expect.element(input).toHaveValue('new photo.png');
    await expect.element(input).toHaveFocus();
    // The Escape key is for the editor
    expect(activeInlineEditors.current).toBe(1);

    await input.fill('Renamed Photo.png');
    await userEvent.keyboard('{Enter}');

    // The name is sanitized
    await expect
      .element(page.getByRole('textbox'))
      .toHaveTextContent('/static/uploads/Renamed Photo.png');
    expect(draft.files[blobURL].file.name).toBe('Renamed Photo.png');
    expect(activeInlineEditors.current).toBe(0);
  });

  test('asks for confirmation when the extension changes, and can cancel', async () => {
    const file = await createMockImageFile({ name: 'photo.png' });
    const blobURL = URL.createObjectURL(file);

    const { draft } = await renderItem(
      blobURL,
      {},
      { files: { [blobURL]: { file, folder: globalAssetFolder.current } } },
    );

    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('textbox').fill('photo.webp');
    await page.getByRole('button', { name: 'Done' }).click();

    const dialog = page.getByRole('alertdialog');

    await expect.element(dialog).toBeInTheDocument();
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await expect.poll(() => draft.files[blobURL].file.name).toBe('photo.webp');

    // Editing can be cancelled
    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('textbox').fill('other.webp');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect.element(page.getByRole('textbox')).toHaveTextContent('/static/uploads/photo.webp');
  });

  test('keeps the name when it’s left as is, or emptied', async () => {
    const file = await createMockImageFile({ name: 'photo.png' });
    const blobURL = URL.createObjectURL(file);

    const { draft } = await renderItem(
      blobURL,
      {},
      { files: { [blobURL]: { file, folder: globalAssetFolder.current } } },
    );

    await page.getByRole('button', { name: 'Rename' }).click();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('textbox')).toHaveTextContent('/static/uploads/photo.png');

    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('textbox').fill('');
    await expect.element(page.getByRole('button', { name: 'Done' })).toBeDisabled();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('textbox')).toHaveTextContent('/static/uploads/photo.png');
    expect(draft.files[blobURL].file).toBe(file);

    // Other keys are left to the input, where the name is selected without the extension
    await page.getByRole('button', { name: 'Rename' }).click();
    await userEvent.keyboard('a');
    await expect.element(page.getByRole('textbox')).toHaveValue('a.png');
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('textbox')).toHaveTextContent('/static/uploads/photo.png');
  });

  test('goes back to the input when the extension change is not confirmed', async () => {
    const file = await createMockImageFile({ name: 'photo.png' });
    const blobURL = URL.createObjectURL(file);

    await renderItem(
      blobURL,
      {},
      { files: { [blobURL]: { file, folder: globalAssetFolder.current } } },
    );

    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('textbox').fill('photo.webp');
    await userEvent.keyboard('{Enter}');

    const dialog = page.getByRole('alertdialog');

    await expect.element(dialog).toBeInTheDocument();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
    await expect.element(page.getByRole('textbox')).toHaveValue('photo.webp');
    await expect.element(page.getByRole('textbox')).toHaveFocus();
  });

  test('clears the preview when the value is removed', async () => {
    const { container, props } = await renderItem('/uploads/photo.png');

    await expect.poll(() => container.querySelector('img')).not.toBeNull();

    props.value = '';
    await expect.poll(() => container.querySelector('img')).toBeNull();
    await expect.element(page.getByRole('textbox')).toHaveTextContent('');
  });

  test('offers the reorder controls in a list', async () => {
    const onMove = vi.fn();

    await renderItem('/uploads/photo.png', { index: 1, itemCount: 3, onMove });

    await page.getByRole('button', { name: 'Reorder Item' }).element().focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onMove).toHaveBeenCalledWith(0, expect.anything());
  });

  test('can be dragged once grabbed', async () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();

    const { container } = await renderItem('/uploads/photo.png', {
      index: 1,
      itemCount: 3,
      onMove: vi.fn(),
      onDragStart,
      onDragEnd,
    });

    const item = /** @type {HTMLElement} */ (container.querySelector('.filled'));
    const handle = page.getByRole('button', { name: 'Reorder Item' });

    handle.element().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await expect.poll(() => item.getAttribute('draggable')).toBe('true');

    const dataTransfer = new DataTransfer();

    item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    expect(onDragStart).toHaveBeenCalledOnce();
    expect(dataTransfer.getData('text/plain')).toBe('/uploads/photo.png');

    item.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    expect(onDragEnd).toHaveBeenCalledOnce();
    await expect.poll(() => item.getAttribute('draggable')).toBe('false');

    // A drag without a data transfer still starts
    handle.element().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await expect.poll(() => item.getAttribute('draggable')).toBe('true');
    item.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
    expect(onDragStart).toHaveBeenCalledTimes(2);
    item.dispatchEvent(new DragEvent('dragend', { bubbles: true }));

    // Releasing the handle without dragging
    handle.element().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await expect.poll(() => item.getAttribute('draggable')).toBe('true');
    handle.element().dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await expect.poll(() => item.getAttribute('draggable')).toBe('false');
  });

  test('disables the actions while read-only', async () => {
    await renderItem('/uploads/photo.png', {
      readonly: true,
      index: 0,
      itemCount: 2,
      onMove: vi.fn(),
    });

    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true');
    await expect.element(page.getByRole('button', { name: 'Replace Image' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Remove Image' })).toBeDisabled();
    expect(page.getByRole('button', { name: 'Reorder Item' }).elements()).toHaveLength(0);
  });
});
