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

    // The positioning is removed, so the element stays in the flow of the preview
    const cover = /** @type {HTMLElement} */ (container.querySelector('.cover'));
    const box = /** @type {HTMLElement} */ (container.querySelector('.markdown'));

    expect(cover.style.position).toBe('');
    expect(cover.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      box.getBoundingClientRect().top,
    );
    expect(cover.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      box.getBoundingClientRect().bottom,
    );
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

  test('removes embedded frames', async () => {
    const { container } = await render(TextPreview, {
      name: 'README.md',
      text: 'Hello\n\n<iframe src="https://evil.example/login"></iframe>',
    });

    await expect
      .poll(() => container.querySelector('.markdown p')?.textContent?.trim())
      .toBe('Hello');
    expect(container.querySelector('iframe')).toBeNull();
  });

  test('removes anything that could restyle or cover the app', async () => {
    const { container } = await render(TextPreview, {
      name: 'README.md',
      text:
        'Hello <style>body { display: none }</style>\n\n' +
        '<div style="position: fixed; inset: 0; z-index: 9999; ' +
        'background: url(https://evil.example/a.png) red; color: blue">' +
        '<form action="https://evil.example/x"><input type="password"><button>Sign in</button>' +
        '</form></div>',
    });

    await expect
      .poll(() => container.querySelector('.markdown p')?.textContent?.trim())
      .toBe('Hello');

    const div = /** @type {HTMLElement} */ (container.querySelector('.markdown div'));

    expect(container.querySelector('style, form, input, button')).toBeNull();
    expect(div.style.position).toBe('');
    expect(div.style.inset).toBe('');
    expect(div.style.zIndex).toBe('');
    expect(div.style.backgroundImage).toBe('');
    expect(div.style.backgroundColor).toBe('red');
    expect(div.style.color).toBe('blue');
  });

  test('makes the rendered Markdown the containing block of positioned content', async () => {
    const { container } = await render(TextPreview, { name: 'README.md', text: '# Hello' });

    await expect.poll(() => container.querySelector('.markdown h1')).not.toBeNull();
    // A transform makes the box the containing block of any `position: fixed` content
    expect(
      getComputedStyle(/** @type {Element} */ (container.querySelector('.markdown'))).translate,
    ).not.toBe('none');
  });
});
