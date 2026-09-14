import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import KeyValuePreview from './key-value-preview.svelte';

/**
 * @import { KeyValueField } from '$lib/types/public';
 */

/**
 * Render the preview within a draft.
 * @param {Record<string, any>} values Flattened values.
 * @param {Partial<KeyValueField>} [config] Field options.
 * @returns {Promise<Awaited<ReturnType<typeof renderWithDraft>>>} Render result.
 */
const renderPreview = async (values, config = {}) => {
  /** @type {KeyValueField} */
  const fieldConfig = { name: 'meta', widget: 'keyvalue', ...config };

  return renderWithDraft(KeyValuePreview, {
    draft: createMockDraft({ fields: [fieldConfig], values: { _default: values } }),
    props: {
      locale: '_default',
      keyPath: 'meta',
      typedKeyPath: 'meta',
      fieldConfig,
      currentValue: undefined,
    },
  });
};

describe('KeyValuePreview', () => {
  test('lists the pairs in a table with the default headers', async () => {
    const { container } = await renderPreview({ 'meta.color': 'red', 'meta.size': 'L' });
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent);

    const rows = [...container.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent),
    );

    expect(headers).toEqual(['Key', 'Value']);
    expect(rows).toEqual([
      ['color', 'red'],
      ['size', 'L'],
    ]);
  });

  test('uses the configured headers', async () => {
    const { container } = await renderPreview(
      { 'meta.color': 'red' },
      { key_label: 'Property', value_label: 'Setting' },
    );

    expect([...container.querySelectorAll('th')].map((th) => th.textContent)).toEqual([
      'Property',
      'Setting',
    ]);
  });

  test('follows a change to the draft', async () => {
    const { entryDraft } = await renderPreview({ 'meta.color': 'red' });

    /** @type {any} */ (entryDraft.current).currentValues._default['meta.size'] = 'L';

    await expect.element(page.getByRole('cell', { name: 'size' })).toBeVisible();
  });

  test('shows nothing when there are no pairs', async () => {
    expect((await renderPreview({})).container.children).toHaveLength(0);
  });

  test('renders nothing without a draft', async () => {
    const { container } = await renderWithDraft(KeyValuePreview, {
      draft: /** @type {any} */ (null),
      props: {
        locale: '_default',
        keyPath: 'meta',
        typedKeyPath: 'meta',
        fieldConfig: { name: 'meta', widget: 'keyvalue' },
      },
    });

    expect(container.querySelector('table')).toBeNull();
  });
});
