import { addMessages, locale } from '@sveltia/i18n';
import componentStrings from '@sveltia/ui/locales/en-US.yaml';
import { createRawSnippet } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import appStrings from '$lib/locales/en-US.yaml';
import { showAssetOverlay } from '$lib/services/assets/view';
import { env } from '$lib/services/user/env.svelte';

import DetailsOverlay from './details-overlay.svelte';

// The English strings under a right-to-left locale, so the elements are still found by their text
addMessages('ar', { ...appStrings, _sui: componentStrings });

const actions = createRawSnippet((/** @type {() => boolean} */ getUseButton) => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => `<button type="button">Actions (${getUseButton() ? 'button' : 'menu'})</button>`,
}));

const editOptions = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<button type="button">Edit Options</button>',
}));

const preview = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<div><p>Preview</p><input aria-label="Field"></div>',
}));

const info = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<aside>Info</aside>',
}));

/**
 * Render the overlay.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<{ container: HTMLElement, onBack: any, onPrevious: any, onNext: any }>}
 * Container and handlers.
 */
const renderOverlay = async (props = {}) => {
  const onBack = vi.fn();
  const onPrevious = vi.fn();
  const onNext = vi.fn();

  const { container } = await render(DetailsOverlay, {
    title: 'photo.png',
    contentKey: 'abc',
    onBack,
    onPrevious,
    onNext,
    actions,
    editOptions,
    preview,
    info,
    ...props,
  });

  return { container, onBack, onPrevious, onNext };
};

/**
 * Simulate a horizontal swipe on the content.
 * @param {HTMLElement} container Container.
 * @param {number} dx Horizontal distance.
 * @param {number} [dy] Vertical distance.
 * @param {Element} [target] Element to start the swipe on.
 * @returns {void}
 */
const swipe = (container, dx, dy = 0, target = undefined) => {
  const row = /** @type {HTMLElement} */ (container.querySelector('.row'));
  const start = target ?? row;
  /**
   * Build a touch.
   * @param {number} x X.
   * @param {number} y Y.
   * @returns {Touch} Touch.
   */
  const touch = (x, y) => new Touch({ identifier: 1, target: start, clientX: x, clientY: y });

  start.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(200, 200)] }));
  start.dispatchEvent(
    new TouchEvent('touchend', { bubbles: true, changedTouches: [touch(200 + dx, 200 + dy)] }),
  );
};

describe('DetailsOverlay', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    showAssetOverlay.current = true;
  });

  test('shows the title, toolbar, preview and info', async () => {
    const { container, onBack, onPrevious, onNext } = await renderOverlay();
    const group = page.getByRole('group', { name: 'Asset Editor' });

    expect(container.querySelector('h2')).toHaveTextContent('photo.png');
    await expect.element(group.getByText('Preview')).toBeInTheDocument();
    await expect.element(group.getByText('Info')).toBeInTheDocument();
    await expect.element(group.getByRole('button', { name: 'Edit Options' })).toBeInTheDocument();
    await expect.element(group.getByRole('button', { name: 'Actions (button)' })).toBeVisible();

    await group.getByRole('button', { name: 'Cancel Editing' }).click();
    expect(onBack).toHaveBeenCalledOnce();

    await group.getByRole('button', { name: 'Previous Asset' }).click();
    expect(onPrevious).toHaveBeenCalledOnce();

    await group.getByRole('button', { name: 'Next Asset' }).click();
    expect(onNext).toHaveBeenCalledOnce();
  });

  test('disables the navigation at the ends of the list', async () => {
    await renderOverlay({ onPrevious: undefined, onNext: undefined });

    await expect.element(page.getByRole('button', { name: 'Previous Asset' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Next Asset' })).toBeDisabled();
  });

  test('navigates with the arrow keys', async () => {
    const { container, onPrevious, onNext } = await renderOverlay();
    const wrapper = /** @type {HTMLElement} */ (container.querySelector('.wrapper'));

    // The overlay takes the focus once shown
    await expect.poll(() => document.activeElement).toBe(wrapper);

    await userEvent.keyboard('{ArrowRight}');
    expect(onNext).toHaveBeenCalledOnce();

    await userEvent.keyboard('{ArrowLeft}');
    expect(onPrevious).toHaveBeenCalledOnce();

    // Modifier keys are left to the browser
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(onPrevious).toHaveBeenCalledOnce();

    // A text field uses the arrow keys itself
    await page.getByRole('textbox', { name: 'Field' }).click();
    await userEvent.keyboard('{ArrowRight}');
    expect(onNext).toHaveBeenCalledOnce();
  });

  test('navigates with a swipe', async () => {
    const { container, onPrevious, onNext } = await renderOverlay();

    swipe(container, -100);
    expect(onNext).toHaveBeenCalledOnce();

    swipe(container, 100);
    expect(onPrevious).toHaveBeenCalledOnce();

    // Too short, or rather vertical
    swipe(container, 30);
    swipe(container, 100, 200);
    expect(onPrevious).toHaveBeenCalledOnce();

    // A slider or media player uses the swipe itself
    swipe(container, 100, 0, /** @type {Element} */ (container.querySelector('input')));
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  test('navigates the other way around in a right-to-left locale', async () => {
    locale.set('ar');

    try {
      const { container, onPrevious, onNext } = await renderOverlay();
      const wrapper = /** @type {HTMLElement} */ (container.querySelector('.wrapper'));

      await expect.poll(() => document.activeElement).toBe(wrapper);
      await expect
        .element(page.getByRole('button', { name: 'Previous Asset' }))
        .toHaveTextContent('arrow_forward');
      await expect
        .element(page.getByRole('button', { name: 'Next Asset' }))
        .toHaveTextContent('arrow_back');

      await userEvent.keyboard('{ArrowRight}');
      expect(onPrevious).toHaveBeenCalledOnce();
      await userEvent.keyboard('{ArrowLeft}');
      expect(onNext).toHaveBeenCalledOnce();

      swipe(container, -100);
      expect(onPrevious).toHaveBeenCalledTimes(2);
      swipe(container, 100);
      expect(onNext).toHaveBeenCalledTimes(2);
    } finally {
      locale.set('en-US');
    }
  });

  test('leaves the focus alone while hidden, and does without the info panel', async () => {
    showAssetOverlay.current = false;

    const { container } = await renderOverlay({ info: undefined });
    const wrapper = /** @type {HTMLElement} */ (container.querySelector('.wrapper'));

    await expect.element(page.getByText('Preview')).toBeVisible();
    expect(container.querySelector('aside')).toBeNull();
    expect(document.activeElement).not.toBe(wrapper);

    showAssetOverlay.current = true;
    await expect.poll(() => document.activeElement).toBe(wrapper);
  });

  test('moves the actions into the overflow menu on a small screen', async () => {
    env.isSmallScreen = true;

    await renderOverlay();

    // The overflow items are rendered by the edit options, so the actions are not in the toolbar
    expect(page.getByRole('button', { name: /Actions/ }).elements()).toHaveLength(0);
  });
});
