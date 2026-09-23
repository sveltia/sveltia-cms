import { sleep } from '@sveltia/utils/misc';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import SubfolderStrip from './subfolder-strip.svelte';

/**
 * @import { AssetSubfolder } from '$lib/types/private';
 */

const subfolders = [
  { name: '2024', path: 'static/uploads/2024' },
  { name: '2025', path: 'static/uploads/2025' },
];

/**
 * Render the strip, keeping the selection in its props like the Select Assets dialog does.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<{ props: any, container: HTMLElement }>} Props and container.
 */
const renderStrip = async (props = {}) => {
  /** @type {Record<string, any>} */
  const _props = $state({
    subfolders,
    onOpen: vi.fn(),
    selectedPaths: /** @type {string[]} */ ([]),
    ...props,
  });

  if (_props.onSelect) {
    const { onSelect } = _props;

    /**
     * Update the selection.
     * @param {AssetSubfolder} subfolder Subfolder.
     * @param {boolean} selected Whether it’s now selected.
     */
    _props.onSelect = (subfolder, selected) => {
      onSelect(subfolder, selected);

      const otherPaths = _props.selectedPaths.filter(
        (/** @type {string} */ p) => p !== subfolder.path,
      );

      _props.selectedPaths = selected
        ? [...(_props.multiple ? otherPaths : []), subfolder.path]
        : otherPaths;
    };
  }

  const { container } = await render(SubfolderStrip, _props);

  // A Sveltia UI list box starts handling clicks and keys 100 ms after it’s mounted
  await sleep(150);

  return { props: _props, container };
};

/**
 * Get the option of a subfolder.
 * @param {string} name Subfolder name.
 * @returns {import('vitest/browser').Locator} Locator.
 */
const getOption = (name) => page.getByRole('option', { name });

/**
 * Get the option under the list box cursor.
 * @returns {string | null | undefined} Subfolder name.
 */
const getFocusedName = () =>
  document.querySelector('[role="option"].focused')?.getAttribute('data-label');

describe('SubfolderStrip', () => {
  test('opens a subfolder with a click, or moves to it with the arrow keys', async () => {
    const onOpen = vi.fn();
    const { container } = await renderStrip({ onOpen });
    const listbox = page.getByRole('listbox', { name: 'Folders' });

    await expect.element(listbox).toHaveClass('grid');
    await expect.element(listbox).not.toHaveAttribute('aria-multiselectable', 'true');

    await getOption('2024').click();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(subfolders[0]);
    // An opened folder isn’t checked
    expect(container.querySelector('.icon.check')).toBeNull();

    // The folders are one tab stop, moved through with the arrow keys, and Enter opens one
    onOpen.mockClear();
    /** @type {HTMLElement} */ (listbox.element()).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(getFocusedName).toBe('2025');
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(getFocusedName).toBe('2024');
    await userEvent.keyboard('{End}');
    await expect.poll(getFocusedName).toBe('2025');
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(subfolders[1]);

    // A double click is only two clicks
    onOpen.mockClear();
    await getOption('2024').dblClick();
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  test('selects a subfolder with a click or the arrow keys, and opens it otherwise', async () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    const { props } = await renderStrip({ viewType: 'list', onOpen, onSelect });
    const listbox = page.getByRole('listbox', { name: 'Folders' });

    await expect.element(listbox).toHaveClass('list');

    // A click selects a folder, and another click clears the selection
    await getOption('2024').click();
    await expect.element(getOption('2024')).toHaveAttribute('aria-selected', 'true');
    expect(props.selectedPaths).toEqual([subfolders[0].path]);
    expect(onOpen).not.toHaveBeenCalled();
    await getOption('2024').click();
    await expect.element(getOption('2024')).toHaveAttribute('aria-selected', 'false');
    expect(props.selectedPaths).toEqual([]);

    // The selection follows the cursor, which the click has left on the first folder, and the Enter
    // key opens the folder without changing it
    /** @type {HTMLElement} */ (listbox.element()).focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(getOption('2025')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(getOption('2024')).toHaveAttribute('aria-selected', 'true');
    await expect.element(getOption('2025')).toHaveAttribute('aria-selected', 'false');
    // The folder losing the selection is reported after the one getting it
    expect(props.selectedPaths).toEqual([subfolders[0].path]);
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(subfolders[0]);
    expect(props.selectedPaths).toEqual([subfolders[0].path]);

    // A double click selects the folder and opens it
    onOpen.mockClear();
    await getOption('2025').dblClick();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(subfolders[1]);
    expect(props.selectedPaths).toEqual([subfolders[1].path]);
  });

  test('toggles the selection of multiple subfolders', async () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    const { props } = await renderStrip({ multiple: true, onOpen, onSelect });
    const listbox = page.getByRole('listbox', { name: 'Folders' });

    await expect.element(listbox).toHaveAttribute('aria-multiselectable', 'true');

    await getOption('2024').click();
    await getOption('2025').click();
    expect(props.selectedPaths).toEqual([subfolders[0].path, subfolders[1].path]);
    await getOption('2024').click();
    expect(props.selectedPaths).toEqual([subfolders[1].path]);

    // The arrow keys only move the cursor, the Space key toggles the selection, and the Enter key
    // opens the folder
    /** @type {HTMLElement} */ (listbox.element()).focus();
    await userEvent.keyboard('{Home}');
    await expect.poll(getFocusedName).toBe('2024');
    expect(props.selectedPaths).toEqual([subfolders[1].path]);
    await userEvent.keyboard(' ');
    expect(props.selectedPaths).toEqual([subfolders[1].path, subfolders[0].path]);
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(subfolders[0]);
    expect(props.selectedPaths).toEqual([subfolders[1].path, subfolders[0].path]);

    // A double click opens the folder, its two clicks leaving the selection as it was
    onOpen.mockClear();
    await getOption('2025').dblClick();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(subfolders[1]);
    expect(props.selectedPaths).toEqual([subfolders[0].path, subfolders[1].path]);
  });

  test('leaves the Enter key to the list box when nothing is under the cursor', async () => {
    const onOpen = vi.fn();

    await renderStrip({ onOpen, onSelect: vi.fn() });

    /** @type {HTMLElement} */ (page.getByRole('listbox').element()).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('a');
    expect(onOpen).not.toHaveBeenCalled();
  });
});
