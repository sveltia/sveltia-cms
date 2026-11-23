import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import UploadButton from './upload-button.svelte';

describe('UploadButton', () => {
  test('is labelled, and calls the handler', async () => {
    const onclick = vi.fn();

    await render(UploadButton, { label: 'Upload', onclick });

    const button = page.getByRole('button', { name: 'Upload New Assets' });

    await expect.element(button).toHaveTextContent('cloud_upload Upload');
    await button.click();
    expect(onclick).toHaveBeenCalledOnce();
  });

  test('is iconic without a label', async () => {
    const { container } = await render(UploadButton, { onclick: vi.fn(), disabled: true });

    expect(container.querySelector('button')).toHaveClass('iconic');
    expect(container.querySelector('button')).toHaveAttribute('aria-disabled', 'true');
  });
});
