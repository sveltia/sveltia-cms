import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { activeInlineEditors } from '$lib/services/contents/editor';

import EditableText from './editable-text.svelte';

/**
 * Render the component with the given props.
 * @param {Record<string, any>} [overrides] Props to override.
 * @returns {Promise<any>} Props, which are bindable.
 */
const renderEditableText = async (overrides = {}) => {
  const props = $state({
    id: 'value',
    value: 'photo.png',
    editLabel: 'Rename',
    editing: false,
    text: '',
    onApply: vi.fn(),
    ...overrides,
  });

  await render(EditableText, props);

  return props;
};

describe('EditableText', () => {
  test('shows the value, which can be edited with the pencil button', async () => {
    const props = await renderEditableText({ ariaLabelledby: 'label' });
    const value = page.getByRole('textbox');

    await expect.element(value).toHaveTextContent('photo.png');
    await expect.element(value).toHaveAttribute('aria-readonly', 'true');
    await expect.element(value).toHaveAttribute('aria-labelledby', 'label');

    await page.getByRole('button', { name: 'Rename' }).click();

    const input = page.getByRole('textbox');

    await expect.element(input).toHaveValue('photo.png');
    await expect.element(input).toHaveFocus();
    expect(props.editing).toBe(true);
    // The Escape key cancels the editing rather than closing the entry editor
    expect(activeInlineEditors.current).toBe(1);

    await input.fill('image.png');
    await page.getByRole('button', { name: 'Done' }).click();

    expect(props.onApply).toHaveBeenCalledExactlyOnceWith('image.png');
    await expect.poll(() => props.editing).toBe(false);
    expect(activeInlineEditors.current).toBe(0);
  });

  test('starts editing with the given text and selection', async () => {
    await renderEditableText({
      value: '/uploads/photo.png',
      initialText: 'photo.png',
      /**
       * Select the file name without the extension.
       * @param {string} text Text.
       * @returns {number} Selection end.
       */
      getSelectionEnd: (text) => text.lastIndexOf('.'),
    });

    await page.getByRole('button', { name: 'Rename' }).click();

    const input = page.getByRole('textbox');

    await expect.element(input).toHaveValue('photo.png');

    const element = /** @type {HTMLInputElement} */ (input.element());

    expect([element.selectionStart, element.selectionEnd]).toEqual([0, 5]);
  });

  test('applies the text with the Enter key, and cancels with the Escape key', async () => {
    const props = await renderEditableText();

    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('textbox').fill('image.png');
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => props.editing).toBe(false);
    expect(props.onApply).not.toHaveBeenCalled();

    await page.getByRole('button', { name: 'Rename' }).click();
    // Other keys are typed as usual
    await userEvent.keyboard('a');
    await page.getByRole('textbox').fill('image.png');
    await userEvent.keyboard('{Enter}');
    expect(props.onApply).toHaveBeenCalledExactlyOnceWith('image.png');
    await expect.poll(() => props.editing).toBe(false);

    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => props.editing).toBe(false);
  });

  test('keeps editing when the text isn’t applied', async () => {
    const props = await renderEditableText({ onApply: vi.fn(() => false) });

    await page.getByRole('button', { name: 'Rename' }).click();
    await userEvent.keyboard('{Enter}');

    expect(props.onApply).toHaveBeenCalledOnce();
    expect(props.editing).toBe(true);
    await expect.element(page.getByRole('textbox')).toHaveValue('photo.png');
  });

  test('disables the Done button when asked', async () => {
    await renderEditableText({ applyDisabled: true, placeholder: 'placeholder' });

    await page.getByRole('button', { name: 'Rename' }).click();

    await expect.element(page.getByRole('button', { name: 'Done' })).toBeDisabled();
    await expect.element(page.getByRole('textbox')).toHaveAttribute('placeholder', 'placeholder');
  });

  test('offers no pencil button when the value can’t be edited', async () => {
    await renderEditableText({ canEdit: false, readonly: false, invalid: true, required: true });

    const value = page.getByRole('textbox');

    expect(page.getByRole('button').elements()).toHaveLength(0);
    await expect.element(value).toHaveAttribute('aria-readonly', 'false');
    await expect.element(value).toHaveAttribute('aria-invalid', 'true');
    await expect.element(value).toBeRequired();
  });
});
