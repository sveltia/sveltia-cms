import { beforeEach, describe, expect, test } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import FilePreview from './file-preview.svelte';

/**
 * @import { MediaField } from '$lib/types/public';
 */

/**
 * Render the preview.
 * @param {MediaField} fieldConfig Field configuration.
 * @param {string | string[] | undefined} currentValue Field value.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (fieldConfig, currentValue) => {
  const { container } = await renderWithDraft(FilePreview, {
    draft: createMockDraft({ fields: [fieldConfig] }),
    props: {
      locale: '_default',
      keyPath: fieldConfig.name,
      typedKeyPath: fieldConfig.name,
      fieldConfig,
      currentValue,
    },
  });

  return container;
};

describe('FilePreview', () => {
  beforeEach(() => {
    // The `multiple` option can also come from the media library configuration
    cmsConfig.current = /** @type {any} */ ({});
  });

  test('shows a single file path', async () => {
    const container = await renderPreview({ name: 'doc', widget: 'file' }, 'docs/report.txt');

    await expect.poll(() => container.textContent).toContain('docs/report.txt');
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  test('shows each file of a multiple field', async () => {
    const container = await renderPreview({ name: 'docs', widget: 'file', multiple: true }, [
      'docs/a.txt',
      'docs/b.txt',
    ]);

    await expect.poll(() => container.querySelectorAll('p').length).toBe(2);
  });

  test('shows nothing without a value', async () => {
    expect((await renderPreview({ name: 'doc', widget: 'file' }, undefined)).children).toHaveLength(
      0,
    );
    expect((await renderPreview({ name: 'doc', widget: 'file' }, '')).children).toHaveLength(0);
    expect(
      (await renderPreview({ name: 'docs', widget: 'file', multiple: true }, 'not-a-list'))
        .children,
    ).toHaveLength(0);
  });
});
