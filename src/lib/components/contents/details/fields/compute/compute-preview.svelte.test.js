import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import ComputePreview from './compute-preview.svelte';

/**
 * Render the preview with the given props.
 * @param {object} props Props to override the defaults with.
 * @returns {Promise<HTMLParagraphElement | null>} Rendered paragraph.
 */
const renderPreview = async (props) => {
  const { container } = await render(ComputePreview, {
    locale: 'en',
    keyPath: 'total',
    typedKeyPath: 'total',
    fieldConfig: { name: 'total', widget: 'compute', value: '{{index}}' },
    currentValue: undefined,
    ...props,
  });

  return container.querySelector('p');
};

describe('ComputePreview', () => {
  test('shows the computed value with the language and direction', async () => {
    const paragraph = await renderPreview({ locale: 'ar', currentValue: 42 });

    expect(paragraph).toHaveTextContent('42');
    expect(paragraph).toHaveAttribute('lang', 'ar');
    expect(paragraph).toHaveAttribute('dir', 'rtl');
  });

  test('shows the value of a string Compute field as is', async () => {
    const paragraph = await renderPreview({ currentValue: 1234 });

    expect(paragraph).toHaveTextContent('1234');
  });

  test('formats the number of a numeric Compute field', async () => {
    const paragraph = await renderPreview({
      fieldConfig: { name: 'total', widget: 'compute', value: '1 + 1', value_type: 'float' },
      currentValue: 1234.5,
    });

    expect(paragraph).toHaveTextContent('1,234.5');
  });

  test('shows nothing for an empty result', async () => {
    const paragraph = await renderPreview({
      fieldConfig: { name: 'total', widget: 'compute', value: '1 + 1', value_type: 'int' },
      currentValue: null,
    });

    expect(paragraph).toHaveTextContent('');
  });
});
