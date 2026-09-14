import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import DeployStatusBadge from './deploy-status-badge.svelte';

describe('DeployStatusBadge', () => {
  test('shows a badge while the preview builds, or when the build failed', async () => {
    const pending = (await render(DeployStatusBadge, { state: 'pending' })).container;

    expect(pending.querySelector('.deploy-status-badge')).toHaveClass('pending');
    expect(pending).toHaveTextContent('Building…');

    const error = (await render(DeployStatusBadge, { state: 'error' })).container;

    expect(error.querySelector('.deploy-status-badge')).toHaveClass('error');
    expect(error).toHaveTextContent('Build Failed');
  });

  test('shows nothing for the other states', async () => {
    expect((await render(DeployStatusBadge, { state: 'ready' })).container.children).toHaveLength(
      0,
    );
    expect(
      (await render(DeployStatusBadge, { state: /** @type {any} */ (undefined) })).container
        .children,
    ).toHaveLength(0);
  });
});
