import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ErrorBoundary from './error-boundary.svelte';

/**
 * Create a snippet that throws while it’s rendered, as long as `state.broken` is `true`.
 * @param {{ broken: boolean }} state State.
 * @returns {import('svelte').Snippet} Snippet.
 */
const createChildren = (state) =>
  createRawSnippet(() => ({
    /**
     * Render the content.
     * @returns {string} HTML.
     * @throws {TypeError} While the content is broken.
     */
    render: () => {
      if (state.broken) {
        throw new TypeError('boom');
      }

      return '<p>Field content</p>';
    },
  }));

describe('ErrorBoundary', () => {
  /** @type {import('vitest').MockInstance} */
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('renders the content as is when nothing fails', async () => {
    await render(ErrorBoundary, { children: createChildren({ broken: false }) });

    await expect.element(page.getByText('Field content')).toBeVisible();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('shows an inline message in place of a field that fails, and renders it again', async () => {
    const state = { broken: true };

    await render(ErrorBoundary, { children: createChildren(state) });

    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent(/Something went wrong, and this field can’t be displayed\. .*boom/);
    await expect.element(page.getByRole('button', { name: 'Reload CMS' })).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(TypeError));

    // A click on the fallback doesn’t reach the field preview, which would highlight the field
    const onclick = vi.fn();
    const onkeydown = vi.fn();

    document.body.addEventListener('click', onclick);
    document.body.addEventListener('keydown', onkeydown);
    page
      .getByRole('button', { name: 'Try Again' })
      .element()
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onkeydown).not.toHaveBeenCalled();
    // Other keys reach their shortcuts, e.g. Escape to close the editor
    page
      .getByRole('button', { name: 'Try Again' })
      .element()
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onkeydown).toHaveBeenCalledOnce();
    state.broken = false;
    await page.getByRole('button', { name: 'Try Again' }).click();
    document.body.removeEventListener('click', onclick);
    document.body.removeEventListener('keydown', onkeydown);
    expect(onclick).not.toHaveBeenCalled();

    await expect.element(page.getByText('Field content')).toBeVisible();
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
  });

  test('shows a full-size message with a button to reload the CMS for a page', async () => {
    await render(ErrorBoundary, { scope: 'page', children: createChildren({ broken: true }) });

    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent(/Something went wrong, and this page can’t be displayed\. .*boom/);
    await expect.element(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Reload CMS' })).toBeVisible();
  });
});
