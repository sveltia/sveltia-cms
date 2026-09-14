import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import StringPreview from './string-preview.svelte';

/**
 * @import { StringField } from '$lib/types/public';
 */

// eslint-disable-next-line no-script-url
const UNSAFE_URL = 'javascript:alert(1)';

/**
 * Render the preview.
 * @param {string | undefined} currentValue Field value.
 * @param {Partial<StringField>} [config] Field options.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue, config = {}) => {
  const { container } = await render(StringPreview, {
    locale: 'en',
    keyPath: 'link',
    typedKeyPath: 'link',
    fieldConfig: { name: 'link', widget: 'string', ...config },
    currentValue,
  });

  return container;
};

describe('StringPreview', () => {
  test('shows plain text', async () => {
    const container = await renderPreview('Hello, world!');

    expect(container).toHaveTextContent('Hello, world!');
    expect(container.querySelector('a')).toBeNull();
  });

  test('links a URL with a safe protocol', async () => {
    const link = (await renderPreview('https://example.com/café')).querySelector('a');

    expect(link).toHaveAttribute('href', 'https://example.com/caf%C3%A9');
    expect(link).toHaveTextContent('https://example.com/café');
  });

  test('shows a URL with an unsafe protocol as text', async () => {
    const container = await renderPreview(UNSAFE_URL, { type: 'url' });

    expect(container).toHaveTextContent(UNSAFE_URL);
    expect(container.querySelector('a')).toBeNull();
  });

  test('links an email address', async () => {
    const link = (await renderPreview('hello@example.com', { type: 'email' })).querySelector('a');

    expect(link).toHaveAttribute('href', 'mailto:hello@example.com');
  });

  test('embeds a YouTube video', async () => {
    const iframe = (await renderPreview('https://www.youtube.com/watch?v=abc123')).querySelector(
      'iframe',
    );

    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abc123');
    expect(iframe).toHaveAttribute('title', 'YouTube video player');
  });

  test('enlarges the title field', async () => {
    expect((await renderPreview('My Post', { name: 'title' })).querySelector('p')).toHaveClass(
      'title',
    );
    expect(
      (await renderPreview('My Post', { name: 'subtitle' })).querySelector('p'),
    ).not.toHaveClass('title');
  });

  test('shows nothing when there is no value or it’s blank', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview('')).children).toHaveLength(0);
    expect((await renderPreview('  ')).children).toHaveLength(0);
  });
});
