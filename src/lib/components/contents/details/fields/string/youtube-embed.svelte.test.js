import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import YouTubeEmbed from './youtube-embed.svelte';

const url = 'https://www.youtube.com/watch?v=abc123';

/**
 * Dispatch a Content Security Policy violation on the window, as the browser does when a frame is
 * blocked by a `frame-src` directive.
 * @param {Partial<SecurityPolicyViolationEventInit>} init Event details.
 */
const dispatchViolation = (init) => {
  window.dispatchEvent(
    new SecurityPolicyViolationEvent('securitypolicyviolation', {
      blockedURI: 'https://www.youtube-nocookie.com',
      violatedDirective: 'frame-src',
      ...init,
    }),
  );
};

describe('YouTubeEmbed', () => {
  test('embeds the video in a sandboxed frame', async () => {
    const { container } = await render(YouTubeEmbed, { url });
    const iframe = container.querySelector('iframe');

    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abc123');
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups');
    expect(iframe).toHaveAttribute('allowfullscreen');
  });

  test('falls back to a link when the frame is blocked by a Content Security Policy', async () => {
    const screen = await render(YouTubeEmbed, { url });

    dispatchViolation({});

    await expect.element(screen.getByRole('link')).toHaveAttribute('href', url);
    expect(screen.container.querySelector('iframe')).toBeNull();

    // The listener has been removed, so a later violation is harmless
    await screen.unmount();
    dispatchViolation({});
  });

  test('ignores a violation of another origin or directive', async () => {
    const { container } = await render(YouTubeEmbed, { url });

    dispatchViolation({ blockedURI: 'https://example.com' });
    dispatchViolation({ violatedDirective: 'img-src' });

    await expect.element(container.querySelector('iframe')).toBeInTheDocument();
    expect(container.querySelector('a')).toBeNull();
  });
});
