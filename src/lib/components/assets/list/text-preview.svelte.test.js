import { parse } from 'marked';
import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import TextPreview from './text-preview.svelte';

vi.mock('marked', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return { ...actual, parse: vi.fn(actual.parse) };
});

describe('TextPreview', () => {
  test('renders Markdown as HTML', async () => {
    const { container } = await render(TextPreview, {
      name: 'README.md',
      text: '# Hello\n\nSome **bold** text.',
    });

    await expect.poll(() => container.querySelector('.markdown h1')?.textContent).toBe('Hello');
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('[role="figure"]')).toHaveClass('markdown');
  });

  test('keeps the Markdown within the preview', async () => {
    const { container } = await render(TextPreview, {
      name: 'README.md',
      text:
        '<style>body { display: none; }</style>\n\n' +
        '<form action="https://example.com/"><input name="token"></form>\n\n' +
        '<div class="cover" style="position: fixed; inset: 0">Sign in again</div>',
    });

    await expect.poll(() => container.querySelector('.cover')).not.toBeNull();
    expect(container.querySelector('style, form')).toBeNull();

    // An element with `position: fixed` is positioned within the preview, not the window
    const cover = /** @type {HTMLElement} */ (container.querySelector('.cover'));
    const box = /** @type {HTMLElement} */ (container.querySelector('.markdown'));

    expect(cover.getBoundingClientRect().top).toBe(box.getBoundingClientRect().top);
    expect(cover.getBoundingClientRect().height).toBe(box.getBoundingClientRect().height);
  });

  test('shows any other text as is', async () => {
    const { container } = await render(TextPreview, { name: 'data.yml', text: 'key: <value>' });

    expect(container.querySelector('pre')?.textContent).toBe('key: <value>');
  });

  test('shows the Markdown as is when it can’t be parsed', async () => {
    vi.mocked(parse).mockRejectedValueOnce(new Error('Boom'));

    const { container } = await render(TextPreview, { name: 'README.md', text: '# Hello' });

    await expect.poll(() => container.querySelector('pre')?.textContent).toBe('# Hello');
  });
});
