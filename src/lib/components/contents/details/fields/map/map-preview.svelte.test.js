import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import MapPreview from './map-preview.svelte';

/**
 * @import { MapField } from '$lib/types/public';
 */

/** @type {MapField} */
const fieldConfig = { name: 'location', widget: 'map' };

/**
 * Render the preview.
 * @param {string | undefined} currentValue Field value.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue) => {
  const { container } = await render(MapPreview, {
    locale: 'en',
    keyPath: 'location',
    typedKeyPath: 'location',
    fieldConfig,
    currentValue,
  });

  return container;
};

describe('MapPreview', () => {
  test('shows the raw GeoJSON', async () => {
    const geoJSON = '{"type":"Point","coordinates":[139.7,35.7]}';

    expect((await renderPreview(geoJSON)).querySelector('pre')?.textContent).toBe(geoJSON);
  });

  test('shows nothing when there is no value', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview('')).children).toHaveLength(0);
  });
});
