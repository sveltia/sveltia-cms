import { describe, expect, test } from 'vitest';

import { renderFieldPreview } from '$lib/test/field.svelte';

import UuidPreview from './uuid-preview.svelte';

/**
 * @import { UuidField } from '$lib/types/public';
 */

/** @type {UuidField} */
const fieldConfig = { name: 'id', widget: 'uuid' };

/**
 * Render the preview.
 * @param {string | undefined} currentValue Field value.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue) =>
  (await renderFieldPreview(UuidPreview, { fieldConfig, currentValue })).container;

describe('UuidPreview', () => {
  test('shows the value', async () => {
    const uuid = '3f4a9e0c-2b1d-4c8e-9a7f-1e2d3c4b5a69';

    expect(await renderPreview(uuid)).toHaveTextContent(uuid);
  });

  test('shows nothing when there is no value or it’s blank', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview('')).children).toHaveLength(0);
    expect((await renderPreview('  ')).children).toHaveLength(0);
  });
});
