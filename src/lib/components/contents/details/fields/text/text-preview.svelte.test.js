import { describe, expect, test } from 'vitest';

import { renderFieldPreview } from '$lib/test/field.svelte';

import TextPreview from './text-preview.svelte';

/**
 * @import { TextField } from '$lib/types/public';
 */

/** @type {TextField} */
const fieldConfig = { name: 'body', widget: 'text' };

/**
 * Render the preview.
 * @param {string | undefined} currentValue Field value.
 * @param {string} [locale] Locale code.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue, locale = 'en') =>
  (await renderFieldPreview(TextPreview, { fieldConfig, locale, currentValue })).container;

describe('TextPreview', () => {
  test('shows the text, preserving line breaks', async () => {
    const paragraph = (await renderPreview('Hello,\nworld!')).querySelector('p');

    expect(paragraph?.textContent).toBe('Hello,\nworld!');
    expect(paragraph).toHaveStyle('white-space: pre-wrap');
  });

  test('marks the paragraph with the language and direction', async () => {
    const paragraph = (await renderPreview('مرحبا', 'ar')).querySelector('p');

    expect(paragraph).toHaveAttribute('lang', 'ar');
    expect(paragraph).toHaveAttribute('dir', 'rtl');
  });

  test('shows nothing when there is no value or it’s blank', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview('')).children).toHaveLength(0);
    expect((await renderPreview('  \n ')).children).toHaveLength(0);
  });
});
