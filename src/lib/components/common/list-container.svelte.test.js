import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import ListContainer from './list-container.svelte';

describe('ListContainer', () => {
  test('groups the content with any extra attributes', async () => {
    const { container } = await render(ListContainer, {
      'aria-label': 'Entries',
      children: createRawSnippet(() => ({
        /**
         * Render the content.
         * @returns {string} HTML.
         */
        render: () => '<p>Item</p>',
      })),
    });

    const group = container.querySelector('.list-container');

    expect(group).toHaveAttribute('role', 'group');
    expect(group).toHaveAttribute('aria-label', 'Entries');
    expect(group).toHaveTextContent('Item');
  });

  test('renders empty without content', async () => {
    const { container } = await render(ListContainer, {});

    expect(container.querySelector('.list-container')).toBeEmptyDOMElement();
  });
});
