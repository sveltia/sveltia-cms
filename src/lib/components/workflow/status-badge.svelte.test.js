import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import StatusBadge from './status-badge.svelte';

/**
 * @import { WorkflowStatus } from '$lib/types/private';
 */

/** @type {[WorkflowStatus, string][]} */
const cases = [
  ['draft', 'Draft'],
  ['pending_review', 'In Review'],
  ['pending_publish', 'Ready'],
  ['pending_deletion', 'Pending Deletion'],
];

describe('StatusBadge', () => {
  test.each(cases)('shows the “%s” status as “%s”', async (status, label) => {
    const { container } = await render(StatusBadge, { status });
    const badge = container.querySelector('.status-badge');

    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveClass(status);
  });
});
