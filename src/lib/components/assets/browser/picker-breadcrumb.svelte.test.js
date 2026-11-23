import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import PickerBreadcrumb from './picker-breadcrumb.svelte';

describe('PickerBreadcrumb', () => {
  test('leads each ancestor of the subfolder being browsed back to itself', async () => {
    const onNavigate = vi.fn();

    await render(PickerBreadcrumb, { rootLabel: 'Media', path: '2024/summer', onNavigate });

    const breadcrumb = page.getByRole('navigation', { name: 'Folder' });

    await expect.element(breadcrumb).toHaveClass('picker-breadcrumb');
    await expect
      .element(breadcrumb)
      .toMatchTextContent('Media chevron_right 2024 chevron_right summer');

    await breadcrumb.getByRole('button', { name: '2024' }).click();
    expect(onNavigate).toHaveBeenCalledWith('2024');
    await breadcrumb.getByRole('button', { name: 'Media' }).click();
    expect(onNavigate).toHaveBeenCalledWith('');
  });

  test('does nothing on a click without a navigation handler', async () => {
    await render(PickerBreadcrumb, { rootLabel: 'Media', path: '2024' });

    const breadcrumb = page.getByRole('navigation', { name: 'Folder' });

    await breadcrumb.getByRole('button', { name: 'Media' }).click();
    await expect.element(breadcrumb).toMatchTextContent('Media chevron_right 2024');
  });

  test('shows nothing at the root', async () => {
    await render(PickerBreadcrumb, { rootLabel: 'Media', path: '', onNavigate: vi.fn() });

    expect(page.getByRole('navigation').elements()).toHaveLength(0);
  });
});
