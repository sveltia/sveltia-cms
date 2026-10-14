import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import Subsection from './subsection.svelte';

const children = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<p>Item content</p>',
}));

describe('Subsection', () => {
  test('groups the content under a label', async () => {
    await render(Subsection, { label: 'Author', children });

    const group = page.getByRole('group', { name: 'Author' });

    await expect.element(group).toBeVisible();
    await expect.element(group.getByText('Item content')).toBeVisible();
  });

  test('has no accessible name without a label', async () => {
    const { container } = await render(Subsection, { children });

    expect(container.querySelector('.header')).toBeNull();
    expect(container.querySelector('[role="group"]')).not.toHaveAttribute('aria-labelledby');
  });

  test('hides the items when no subfield is shown', async () => {
    const { container } = await render(Subsection, {
      label: 'Author',
      children: createRawSnippet(() => ({
        /**
         * Render the wrapper of a subfield that isn’t shown in the preview.
         * @returns {string} HTML.
         */
        render: () => '<div data-lazy-key-path="a"><!----></div>',
      })),
    });

    expect(
      getComputedStyle(/** @type {Element} */ (container.querySelector('.items'))).display,
    ).toBe('none');
  });

  test('shows the items while a subfield is waiting to be rendered', async () => {
    const { container } = await render(Subsection, {
      label: 'Author',
      children: createRawSnippet(() => ({
        /**
         * Render the wrapper of a subfield not rendered yet.
         * @returns {string} HTML.
         */
        render: () => '<div data-lazy-key-path="a"><div class="placeholder"></div></div>',
      })),
    });

    expect(
      getComputedStyle(/** @type {Element} */ (container.querySelector('.items'))).display,
    ).not.toBe('none');
  });
});
