import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import StatusPill from './status-pill.svelte';

describe('StatusPill', () => {
  test('shows the label in the given tone', async () => {
    const { container } = await render(StatusPill, { tone: 'warning', label: 'In Review' });
    const pill = container.querySelector('.status-pill');

    expect(pill).toHaveTextContent('In Review');
    expect(pill).toHaveClass('warning');
    expect(pill).toHaveAttribute('role', 'none');
  });

  test('adds the given class names', async () => {
    const { container } = await render(StatusPill, {
      tone: 'error',
      label: 'Build Failed',
      class: 'deploy-status-badge error',
    });

    expect(container.querySelector('.status-pill')).toHaveClass(
      'status-pill',
      'error',
      'deploy-status-badge',
    );
  });
});
