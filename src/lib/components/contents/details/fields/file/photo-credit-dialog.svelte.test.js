import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import PhotoCreditDialog from './photo-credit-dialog.svelte';

const CREDIT = 'Photo by <a href="https://example.com/melvin?a=1&amp;b=2">Melvin</a>';
const CREDIT_MARKDOWN = 'Photo by [Melvin](https://example.com/melvin?a=1&b=2)';

/**
 * Render the dialog, open, for an Image field within a draft.
 * @param {object} [options] Options.
 * @param {any[]} [options.fields] Other fields of the entry.
 * @param {Record<string, any>} [options.values] Flattened values.
 * @param {Record<string, any>} [options.props] Props to override.
 * @returns {Promise<{ draft: any, props: any, dialog: import('vitest/browser').Locator }>} Draft,
 * props and the dialog.
 */
const renderDialog = async ({ fields = [], values = {}, props = {} } = {}) => {
  const draft = createMockDraft({
    fields: [{ name: 'image', widget: 'image' }, ...fields],
    values: { _default: values },
  });

  const _props = $state({
    open: true,
    credit: CREDIT,
    locale: '_default',
    keyPath: 'image',
    valueStoreKey: 'currentValues',
    ...props,
  });

  await renderWithDraft(PhotoCreditDialog, { draft, props: _props });

  const dialog = page.getByRole('alertdialog', { name: 'Photo Credit' });

  await expect.element(dialog.getByRole('textbox')).toHaveValue(CREDIT);

  return { draft, props: _props, dialog };
};

describe('PhotoCreditDialog', () => {
  beforeEach(async () => {
    await initTestConfig({ collections: [] });
  });

  test('shows the credit, which can be copied', async () => {
    const { props, dialog } = await renderDialog();

    // The text is selected on click, ready to be copied
    dialog
      .getByRole('textbox')
      .element()
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect.element(dialog.getByRole('textbox')).toHaveFocus();
    // Without a Markdown field, there is nowhere to insert the credit
    await expect.element(dialog.getByRole('button', { name: /^Insert/ })).not.toBeInTheDocument();
    await expect.element(dialog.getByRole('button', { name: 'Copy' })).toHaveClass('primary');

    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    await dialog.getByRole('button', { name: 'Copy' }).click();
    expect(writeText).toHaveBeenCalledWith(CREDIT);
    expect(props.open).toBe(false);
    await expect.element(dialog).not.toBeInTheDocument();
  });

  test('copies the credit as Markdown', async () => {
    const { props, dialog } = await renderDialog();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    await dialog.getByRole('button', { name: 'More Options' }).click();
    await page.getByRole('menuitem', { name: 'Copy as Markdown' }).click();
    expect(writeText).toHaveBeenCalledWith(CREDIT_MARKDOWN);
    expect(props.open).toBe(false);
  });

  test('closes without doing anything', async () => {
    const { draft, props, dialog } = await renderDialog({
      fields: [{ name: 'body', widget: 'markdown' }],
    });

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(props.open).toBe(false);

    props.open = true;
    await expect.element(dialog).toBeInTheDocument();
    // The dialog can be dismissed with the keyboard
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
    expect(props.open).toBe(false);
    expect(draft.currentValues._default.body).toBeUndefined();
  });

  test('inserts the credit at the end of a Markdown field', async () => {
    const { draft, props, dialog } = await renderDialog({
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'body', label: 'Body', widget: 'markdown' },
      ],
      values: { body: 'Hello.' },
    });

    await expect.element(dialog.getByRole('button', { name: 'Copy' })).not.toHaveClass('primary');
    await dialog.getByRole('button', { name: 'Insert to \u2068Body\u2069' }).click();
    expect(draft.currentValues._default.body).toBe(`Hello.\n\n${CREDIT_MARKDOWN}`);
    expect(props.open).toBe(false);
  });

  test('inserts the credit into an HTML field as a paragraph', async () => {
    const { draft, dialog } = await renderDialog({
      fields: [{ name: 'body', widget: 'richtext', format: 'html' }],
    });

    // The field name stands in for the label
    await dialog.getByRole('button', { name: 'Insert to \u2068body\u2069' }).click();
    expect(draft.currentValues._default.body).toBe(`<p>${CREDIT}</p>`);
  });

  test('offers no Markdown field within a component without a caption', async () => {
    const { dialog } = await renderDialog({
      fields: [{ name: 'body', label: 'Body', widget: 'markdown' }],
      props: { keyPath: 'body:c1:photo', valueStoreKey: 'extraValues', componentName: 'x-gallery' },
    });

    await expect.element(dialog.getByRole('button', { name: /^Insert/ })).not.toBeInTheDocument();
    await expect.element(dialog.getByRole('button', { name: 'Copy' })).toHaveClass('primary');
  });

  test('inserts the credit as the caption of an image component', async () => {
    const { draft, props, dialog } = await renderDialog({
      fields: [{ name: 'body', label: 'Body', widget: 'markdown' }],
      props: { keyPath: 'body:c1:src', valueStoreKey: 'extraValues', componentName: 'image' },
    });

    await dialog.getByRole('button', { name: 'Insert', exact: true }).click();
    expect(draft.extraValues._default['body:c1:caption']).toBe(CREDIT);
    expect(draft.currentValues._default.body).toBeUndefined();
    expect(props.open).toBe(false);
  });
});
