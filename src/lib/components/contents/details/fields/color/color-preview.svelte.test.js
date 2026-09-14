import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import ColorPreview from './color-preview.svelte';

/**
 * @import { ColorField } from '$lib/types/public';
 */

/**
 * Render the preview.
 * @param {string | undefined} currentValue Field value.
 * @param {Partial<ColorField>} [config] Field options.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue, config = {}) => {
  const { container } = await render(ColorPreview, {
    locale: 'en',
    keyPath: 'color',
    typedKeyPath: 'color',
    fieldConfig: { name: 'color', widget: 'color', ...config },
    currentValue,
  });

  return container;
};

describe('ColorPreview', () => {
  test('shows a swatch, the hex value and the RGB value', async () => {
    const container = await renderPreview('#ff8000');

    expect(container.querySelector('.color')).toHaveStyle('background-color: rgb(255, 128, 0)');
    expect(container).toHaveTextContent('#ff8000 rgb(255 128 0)');
  });

  test('includes the alpha channel when enabled', async () => {
    expect(await renderPreview('#ff800080', { enableAlpha: true })).toHaveTextContent(
      '#ff800080 rgb(255 128 0 / 50%)',
    );
    expect(await renderPreview('#ff800080')).toHaveTextContent('#ff800080 rgb(255 128 0)');
  });

  test('shows a value that is not a hex color as is', async () => {
    const container = await renderPreview('red');

    expect(container.querySelector('.color')).toHaveStyle('background-color: rgb(255, 0, 0)');
    expect(container.querySelectorAll('.value')[0]).toHaveTextContent('red');
    expect(container.querySelectorAll('.value')[1].textContent).toBe('');
  });

  test('shows nothing when there is no value or it’s blank', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview('')).children).toHaveLength(0);
    expect((await renderPreview('  ')).children).toHaveLength(0);
  });
});
