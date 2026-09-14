import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ComputeEditor from './compute-editor.svelte';

/**
 * @import { ComputeField } from '$lib/types/public';
 */

/** @type {ComputeField} */
const fieldConfig = { name: 'slug', widget: 'compute', value: '{{title}}' };

describe('ComputeEditor', () => {
  test('shows the computed value in a labelled input', async () => {
    await render(ComputeEditor, {
      locale: 'en',
      keyPath: 'slug',
      typedKeyPath: 'slug',
      fieldId: 'slug',
      fieldLabel: 'Slug',
      fieldConfig,
      currentValue: 'hello-world',
    });

    const input = page.getByRole('textbox');

    await expect.element(input).toHaveValue('hello-world');
    await expect.element(input).toHaveAttribute('aria-labelledby', 'slug-label');
    await expect.element(input).toHaveAttribute('aria-errormessage', 'slug-error');
  });

  test('shows a numeric value', async () => {
    await render(ComputeEditor, {
      locale: 'en',
      keyPath: 'total',
      typedKeyPath: 'total',
      fieldId: 'total',
      fieldLabel: 'Total',
      fieldConfig,
      currentValue: 42,
    });

    await expect.element(page.getByRole('textbox')).toHaveValue('42');
  });
});
