import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ColorEditor from './color-editor.svelte';

/**
 * @import { ColorField } from '$lib/types/public';
 */

/**
 * Render the editor with a bindable value.
 * @param {object} [options] Options.
 * @param {string | undefined} [options.currentValue] Field value.
 * @param {Partial<ColorField>} [options.config] Field options.
 * @param {boolean} [options.required] Whether the field is required.
 * @returns {Promise<{ props: { currentValue: string | undefined }, container: HTMLElement }>}
 * Props, whose `currentValue` follows the editor, and the container.
 */
const renderEditor = async ({ currentValue = undefined, config = {}, required = true } = {}) => {
  const props = $state({
    locale: 'en',
    keyPath: 'color',
    typedKeyPath: 'color',
    fieldId: 'color',
    fieldLabel: 'Color',
    fieldConfig: /** @type {ColorField} */ ({ name: 'color', widget: 'color', ...config }),
    currentValue,
    required,
  });

  const { container } = await render(ColorEditor, props);

  return { props, container };
};

/**
 * Get the color picker.
 * @param {HTMLElement} container Container.
 * @returns {HTMLInputElement} Input.
 */
const getPicker = (container) =>
  /** @type {HTMLInputElement} */ (container.querySelector('input[type="color"]'));

describe('ColorEditor', () => {
  test('reflects the value in a labelled color picker', async () => {
    const { container } = await renderEditor({ currentValue: '#ff8000' });
    const picker = getPicker(container);

    expect(picker.value).toBe('#ff8000');
    expect(picker).toHaveAttribute('aria-labelledby', 'color-label');
    expect(picker).toHaveAttribute('aria-errormessage', 'color-error');
    expect(container.querySelector('input[type="text"]')).toBeNull();
  });

  test('updates the value when a color is picked', async () => {
    const { props, container } = await renderEditor({ currentValue: '' });
    const picker = getPicker(container);

    picker.value = '#00ff00';
    picker.dispatchEvent(new Event('input', { bubbles: true }));

    await expect.poll(() => props.currentValue).toBe('#00ff00');
  });

  test('offers a text input when allowed', async () => {
    const { props, container } = await renderEditor({
      currentValue: '#ff8000',
      config: { allowInput: true },
    });

    const input = page.elementLocator(
      /** @type {HTMLElement} */ (container.querySelector('input[type="text"]')),
    );

    await expect.element(input).toHaveValue('#ff8000');
    await input.fill('#0000ff');
    expect(props.currentValue).toBe('#0000ff');

    // An incomplete color is not stored
    await input.fill('#00f');
    expect(props.currentValue).toBe('');
  });

  test('offers an opacity slider when the alpha channel is enabled', async () => {
    const { props, container } = await renderEditor({
      currentValue: '#ff800080',
      config: { enableAlpha: true },
    });

    const slider = page.getByRole('slider', { name: 'Opacity' });

    expect(getPicker(container).value).toBe('#ff8000');
    await expect.element(slider).toHaveAttribute('aria-valuenow', '128');

    await slider.element().focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => props.currentValue).toBe('#ff800081');
  });

  test('can be cleared when optional', async () => {
    const { props, container } = await renderEditor({ currentValue: '#ff8000', required: false });

    await page.getByRole('button', { name: 'Clear' }).click();

    expect(props.currentValue).toBe('');
    expect(getPicker(container).value).toBe('#000000');

    // The button also controls the text input when there is one
    await renderEditor({ currentValue: '#ff8000', required: false, config: { allowInput: true } });
    expect(
      page
        .getByRole('button', { name: 'Clear' })
        .nth(1)
        .element()
        .getAttribute('aria-controls')
        ?.split(' '),
    ).toHaveLength(2);
  });

  test('cannot be cleared when required', async () => {
    await renderEditor({ currentValue: '#ff8000' });

    expect(page.getByRole('button', { name: 'Clear' }).elements()).toHaveLength(0);
  });
});
