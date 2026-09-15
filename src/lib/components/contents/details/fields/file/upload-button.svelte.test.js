import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';
import { waitForToastsToHide } from '$lib/test/toast';

import UploadButton from './upload-button.svelte';

/**
 * Render the button.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<any>} Props.
 */
const renderButton = async (props = {}) => {
  const _props = $state({
    allowDrop: true,
    invalid: false,
    readonly: false,
    processing: false,
    isImageField: true,
    multiple: false,
    showSelectAssetsDialog: false,
    replaceMode: true,
    ...props,
  });

  await render(UploadButton, _props);

  return _props;
};

describe('UploadButton', () => {
  beforeEach(() => {
    env.hasMouse = true;
  });

  test('opens the asset dialog on click', async () => {
    const props = await renderButton();
    const area = page.getByText(/Drop an image file here or/);

    await expect.element(area).toHaveTextContent('Drop an image file here or Browse');
    // The area is a click target, not a control: the only button is the one inside it
    expect(page.getByRole('button').elements()).toHaveLength(1);

    await area.click();
    expect(props.showSelectAssetsDialog).toBe(true);
    // Replacing is off when starting afresh
    expect(props.replaceMode).toBe(false);
  });

  test('offers to browse, or paste an image', async () => {
    const onFilePaste = vi.fn();
    const props = await renderButton({ onFilePaste, multiple: true, isImageField: false });

    await expect
      .element(page.getByText(/Drop files here or/))
      .toHaveTextContent('Drop files here or Browse Paste');

    await page.getByRole('button', { name: 'Browse' }).click();
    expect(props.showSelectAssetsDialog).toBe(true);

    const blob = new Blob(['x'], { type: 'image/png' });

    vi.spyOn(navigator.clipboard, 'read').mockResolvedValue([
      /** @type {any} */ ({ types: ['image/png'], getType: vi.fn().mockResolvedValue(blob) }),
    ]);

    await page.getByRole('button', { name: 'Paste' }).click();
    await vi.waitFor(() => expect(onFilePaste).toHaveBeenCalled());

    const file = onFilePaste.mock.calls[0][0];

    expect(file.name).toMatch(/^pasted-image-\d+\.png$/);
    expect(file.type).toBe('image/png');
  });

  test('pastes with the keyboard shortcut', async () => {
    const onFilePaste = vi.fn();

    await renderButton({ onFilePaste });

    vi.spyOn(navigator.clipboard, 'read').mockResolvedValue([
      /** @type {any} */ ({
        types: ['image/svg+xml'],
        getType: vi.fn().mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' })),
      }),
    ]);

    // The shortcut works while any of the buttons in the area has focus
    page.getByRole('button', { name: 'Browse' }).element().focus();
    // The modifier depends on the platform
    await userEvent.keyboard('{Control>}v{/Control}');
    await userEvent.keyboard('{Meta>}v{/Meta}');
    await vi.waitFor(() => expect(onFilePaste).toHaveBeenCalled());
    expect(onFilePaste.mock.calls[0][0].name).toMatch(/\.svg$/);
  });

  test('reports a clipboard without an image, or without access', async () => {
    await renderButton({ onFilePaste: vi.fn() });

    vi.spyOn(navigator.clipboard, 'read').mockResolvedValue([
      /** @type {any} */ ({ types: ['text/plain'] }),
    ]);
    await page.getByRole('button', { name: 'Paste Image' }).click();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Error No image found in clipboard.');

    vi.spyOn(navigator.clipboard, 'read').mockRejectedValue(new Error('Denied'));
    await page.getByRole('button', { name: 'Paste Image' }).click();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Error Clipboard access denied.');
    await waitForToastsToHide();
  });

  test('asks to click when files can’t be dropped', async () => {
    await renderButton({ allowDrop: false });

    await expect
      .element(page.getByText(/Click to browse/))
      .toHaveTextContent('Click to browse… Browse');
  });

  test('asks for a single file, or several images', async () => {
    await renderButton({ isImageField: false });

    await expect.element(page.getByText(/Drop a file here or/)).toBeInTheDocument();

    await renderButton({ multiple: true });

    await expect.element(page.getByText(/Drop image files here or/)).toBeInTheDocument();
  });

  test('shows the progress while processing', async () => {
    await renderButton({ processing: true, multiple: true });

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('Processing files. This may take a while.');
    expect(page.getByRole('button', { name: 'Browse' }).elements()).toHaveLength(0);
    expect(document.querySelector('.empty')).toHaveClass('disabled');

    await renderButton({ processing: true });
    await expect
      .element(page.getByRole('status').nth(1))
      .toHaveTextContent('Processing a file. This may take a while.');
  });

  test('offers the buttons alone on a touch device', async () => {
    env.hasMouse = false;

    const props = await renderButton();

    await expect.element(page.getByRole('button', { name: 'Browse' })).toBeInTheDocument();

    const area = /** @type {HTMLElement} */ (document.querySelector('.empty'));

    // No instructions to drop or click, just the button
    expect(area).toHaveTextContent('cloud_upload Browse');

    // Tapping the area does nothing, as there is no drop
    area.click();
    expect(props.showSelectAssetsDialog).toBe(false);
  });

  test('is disabled while read-only', async () => {
    const props = await renderButton({ readonly: true });

    await expect
      .element(page.getByRole('button', { name: 'Browse' }))
      .toHaveAttribute('aria-disabled', 'true');
    await page.getByText(/Drop/).click({ force: true });
    expect(props.showSelectAssetsDialog).toBe(false);
  });
});
