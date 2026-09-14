import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import ComputePreview from './compute-preview.svelte';

describe('ComputePreview', () => {
  test('shows the computed value with the language and direction', async () => {
    const { container } = await render(ComputePreview, {
      locale: 'ar',
      keyPath: 'total',
      typedKeyPath: 'total',
      fieldConfig: { name: 'total', widget: 'string' },
      currentValue: 42,
    });

    const paragraph = container.querySelector('p');

    expect(paragraph).toHaveTextContent('42');
    expect(paragraph).toHaveAttribute('lang', 'ar');
    expect(paragraph).toHaveAttribute('dir', 'rtl');
  });
});
