import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import PanelContainer from './panel-container.svelte';

describe('PanelContainer', () => {
  test('renders a labelled section with actions and content', async () => {
    const actions = createRawSnippet(() => ({
      /**
       * Render the content.
       * @returns {string} HTML.
       */
      render: () => '<button type="button">Refresh</button>',
    }));

    const children = createRawSnippet(() => ({
      /**
       * Render the content.
       * @returns {string} HTML.
       */
      render: () => '<p>Content</p>',
    }));

    await render(PanelContainer, { title: 'History', actions, children });

    const group = page.getByRole('group', { name: 'History' });

    await expect.element(group.getByRole('heading', { level: 3 })).toHaveTextContent('History');
    await expect.element(group.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    await expect.element(group.getByText('Content')).toBeInTheDocument();
  });

  test('does without actions and content', async () => {
    await render(PanelContainer, { title: 'History' });

    const group = page.getByRole('group', { name: 'History' });

    await expect.element(group.getByRole('heading', { level: 3 })).toHaveTextContent('History');
    expect(group.getByRole('button').elements()).toHaveLength(0);
  });
});
