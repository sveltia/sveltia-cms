import { sleep } from '@sveltia/utils/misc';
import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import SimpleImageGridItem from './simple-image-grid-item.svelte';
import SimpleImageGrid from './simple-image-grid.svelte';

const children = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<img src="data:," alt="Photo">',
}));

describe('SimpleImageGridItem', () => {
  test('renders an option with the content', async () => {
    const onChange = vi.fn();

    const { container } = await render(
      SimpleImageGridItem,
      {
        value: 'photo',
        ariaLabel: 'photo.png',
        selected: false,
        multiple: false,
        children,
        onChange,
      },
      { wrapper: SimpleImageGrid },
    );

    const option = page.getByRole('option', { name: 'photo.png' });

    await expect.element(option).toHaveAttribute('data-value', 'photo');
    await expect.element(option).toHaveAttribute('aria-selected', 'false');
    await expect.element(option.getByRole('img', { name: 'Photo' })).toBeInTheDocument();
    expect(container.querySelector('[role="option"]')?.closest('.wrapper')).toHaveClass('grid');
    // The check mark is only for multiple selection
    expect(container.querySelector('.check-background')).toBeNull();

    await sleep(150);
    await option.click();
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  test('shows a check mark for multiple selection', async () => {
    const { container } = await render(
      SimpleImageGridItem,
      {
        value: 'photo',
        ariaLabel: 'photo.png',
        selected: true,
        multiple: true,
        viewType: 'list',
        children,
        onChange: vi.fn(),
      },
      { wrapper: SimpleImageGrid },
    );

    await expect.element(page.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelector('[role="option"]')?.closest('.wrapper')).toHaveClass('list');
    expect(container.querySelector('.check-background')).not.toBeNull();
  });
});
