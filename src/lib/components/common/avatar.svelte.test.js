import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import Avatar from './avatar.svelte';

/** A valid 1×1 picture. */
const PICTURE = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

describe('Avatar', () => {
  test('shows the picture, without an accessible name, as the name is given next to it', async () => {
    const { container } = await render(Avatar, { name: 'Ada Lovelace', src: PICTURE });
    const image = /** @type {HTMLImageElement} */ (container.querySelector('img'));

    expect(image).toHaveAttribute('src', PICTURE);
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('width', '24');
  });

  test('shows the initials without a picture, at the given size', async () => {
    const { container } = await render(Avatar, { name: 'Ada Lovelace', size: 28, class: 'x' });
    const initials = /** @type {HTMLElement} */ (container.querySelector('.initials'));

    expect(initials).toHaveTextContent('AL');
    expect(initials).toHaveAttribute('aria-hidden', 'true');
    expect(initials).toHaveClass('x');
    expect(getComputedStyle(initials).width).toBe('28px');
  });

  test('takes the initials from the username if the name has no letters', async () => {
    const { container } = await render(Avatar, { name: '🙂', username: 'ada' });

    expect(container.querySelector('.initials')).toHaveTextContent('A');
  });

  test('shows the given text instead, in a neutral color', async () => {
    const { container } = await render(Avatar, { text: '+2' });
    const avatar = /** @type {HTMLElement} */ (container.querySelector('.initials'));

    expect(avatar).toHaveTextContent('+2');
    expect(avatar).toHaveClass('neutral');
  });

  test('shows the initials when the picture can’t be loaded', async () => {
    const { container } = await render(Avatar, {
      name: 'Real Kohei',
      src: 'data:image/png;base64,AAAA',
    });

    await expect.poll(() => container.querySelector('.initials')?.textContent?.trim()).toBe('RK');
    expect(container.querySelector('img')).toBeNull();
  });
});
